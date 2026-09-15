/**
 * ApeX Protocol Market Maker
 *
 * Posts two-sided quotes into the protocol's on-chain order book, anchored to
 * the market's Pyth oracle price. Without resting liquidity the order book is
 * empty, no fills occur, and the indexer has nothing to build candles from — so
 * this bot is what makes ApeX's own book and chart actually functional.
 *
 * Safety notes:
 *  - The program enforces self-trade prevention (`bid.owner != ask.owner`), so
 *    this bot quoting both sides can never be matched against itself. It only
 *    ever fills against real counterparties.
 *  - Quotes are re-anchored to the oracle each cycle: stale orders are
 *    cancelled before new ones are placed, so the bot does not leave resting
 *    liquidity far from fair value after a price move.
 *  - This is devnet liquidity bootstrapping. It should be disclosed as
 *    protocol-operated market making, not presented as organic volume.
 */

import { createHash } from "crypto";
import { utils as anchorUtils } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as dotenv from "dotenv";

dotenv.config();

const DEFAULT_PROGRAM_ID = "E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s";
const DEFAULT_BASE_MINT = "4zMMC9srt5Ri5X14GVnYj7wAVTJGN1YjBe5HL4s3bQDa";

// ── Protocol constants (mirror programs/apex_protocol/src/constants.rs) ──────
const PRICE_DECIMALS = 1_000_000n;
const SIZE_DECIMALS = 1_000_000n;
const FEE_DENOMINATOR = 10_000n;
const MAX_CONFIDENCE_BPS = 100n;
const ORACLE_STALENESS = 60;
const MAX_ABS_PYTH_EXPONENT = 12;
const MAX_ORDERS = 500;

// ── Account layout ──────────────────────────────────────────────────────────
const MARKET_ACCOUNT_SIZE = 8 + 193;
const MARKET_ORACLE_OFFSET = 40;
const MARKET_VAULT_OFFSET = 72;
const MARKET_BASE_MINT_OFFSET = 104;
const ORDER_SIZE = 67;

// ── Pyth offsets ────────────────────────────────────────────────────────────
const PYTH_MAGIC = 0xa1b2c3d4;
const PYTH_VERSION_2 = 2;
const PYTH_PRICE_ACCOUNT_TYPE = 3;
const PYTH_STATUS_TRADING = 1;
const PYTH_EXPO_OFFSET = 20;
const PYTH_TIMESTAMP_OFFSET = 96;
const PYTH_PREV_PRICE_OFFSET = 184;
const PYTH_PREV_CONF_OFFSET = 192;
const PYTH_PREV_TIMESTAMP_OFFSET = 200;
const PYTH_AGG_PRICE_OFFSET = 208;
const PYTH_AGG_CONF_OFFSET = 216;
const PYTH_AGG_STATUS_OFFSET = 224;

/** Side discriminant as encoded by the program's `Side` enum. */
const SIDE_LONG = 0;
const SIDE_SHORT = 1;

interface MarketMakerConfig {
  rpcUrl: string;
  programId: PublicKey;
  keypair: Keypair | null;
  baseMint: PublicKey;
  /** Half-spread of the innermost quote, in basis points. */
  spreadBps: number;
  /** Additional bps between each successive level. */
  levelStepBps: number;
  /** Number of levels to post per side. */
  levels: number;
  /** Quote-denominated notional per level, in whole tokens. */
  orderNotional: number;
  leverage: number;
  requoteIntervalMs: number;
  runOnce: boolean;
  dryRun: boolean;
}

interface MarketState {
  oracle: PublicKey;
  vault: PublicKey;
  baseMint: PublicKey;
}

interface RestingOrder {
  index: number;
  owner: PublicKey;
  side: number;
  price: bigint;
  status: number;
}

function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function parseKeypair(rawKey: string): Keypair {
  const trimmed = rawKey.trim();
  try {
    if (trimmed.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed) as number[]));
    }
    return Keypair.fromSecretKey(Uint8Array.from(anchorUtils.bytes.bs58.decode(trimmed)));
  } catch (err) {
    throw new Error(
      `MM_PRIVATE_KEY could not be parsed as a JSON byte array or base58 secret key: ${
        (err as Error).message
      }`,
    );
  }
}

function intFromEnv(name: string, fallback: number): number {
  const parsed = Number.parseFloat(process.env[name] || "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function loadConfig(): MarketMakerConfig {
  const rawKey = process.env.MM_PRIVATE_KEY;
  if (!rawKey) {
    console.warn(
      "⚠️  MM_PRIVATE_KEY is not set — running in READ-ONLY mode. No quotes will be posted.",
    );
  }

  return {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    programId: new PublicKey(process.env.APEX_PROTOCOL_PROGRAM_ID || DEFAULT_PROGRAM_ID),
    keypair: rawKey ? parseKeypair(rawKey) : null,
    baseMint: new PublicKey(process.env.APEX_BASE_MINT || DEFAULT_BASE_MINT),
    spreadBps: intFromEnv("MM_SPREAD_BPS", 10),
    levelStepBps: intFromEnv("MM_LEVEL_STEP_BPS", 5),
    levels: Math.min(Math.floor(intFromEnv("MM_LEVELS", 5)), 20),
    orderNotional: intFromEnv("MM_ORDER_NOTIONAL", 100),
    leverage: Math.min(Math.max(Math.floor(intFromEnv("MM_LEVERAGE", 2)), 1), 10),
    requoteIntervalMs: intFromEnv("MM_REQUOTE_INTERVAL_MS", 20_000),
    runOnce: process.argv.includes("--once"),
    dryRun: process.argv.includes("--dry-run") || process.env.DRY_RUN === "true",
  };
}

function decodeMarket(data: Buffer): MarketState {
  if (data.length !== MARKET_ACCOUNT_SIZE) {
    throw new Error(
      `Unexpected Market account size ${data.length}, expected ${MARKET_ACCOUNT_SIZE}. ` +
        `The deployed program does not match this build.`,
    );
  }

  return {
    oracle: new PublicKey(data.subarray(MARKET_ORACLE_OFFSET, MARKET_ORACLE_OFFSET + 32)),
    vault: new PublicKey(data.subarray(MARKET_VAULT_OFFSET, MARKET_VAULT_OFFSET + 32)),
    baseMint: new PublicKey(
      data.subarray(MARKET_BASE_MINT_OFFSET, MARKET_BASE_MINT_OFFSET + 32),
    ),
  };
}

/** Mirrors the program's `get_oracle_price`, returning 6-decimal fixed point. */
function readOraclePrice(data: Buffer, nowSeconds: number): bigint | null {
  if (data.length < PYTH_AGG_STATUS_OFFSET + 1) return null;
  if (data.readUInt32LE(0) !== PYTH_MAGIC) return null;
  if (data.readUInt32LE(4) !== PYTH_VERSION_2) return null;
  if (data.readUInt32LE(8) !== PYTH_PRICE_ACCOUNT_TYPE) return null;

  const exponent = data.readInt32LE(PYTH_EXPO_OFFSET);
  if (Math.abs(exponent) > MAX_ABS_PYTH_EXPONENT) return null;

  const trading = data.readUInt8(PYTH_AGG_STATUS_OFFSET) === PYTH_STATUS_TRADING;
  const rawPrice = trading
    ? data.readBigInt64LE(PYTH_AGG_PRICE_OFFSET)
    : data.readBigInt64LE(PYTH_PREV_PRICE_OFFSET);
  const confidence = trading
    ? data.readBigUInt64LE(PYTH_AGG_CONF_OFFSET)
    : data.readBigUInt64LE(PYTH_PREV_CONF_OFFSET);
  const publishTime = trading
    ? Number(data.readBigInt64LE(PYTH_TIMESTAMP_OFFSET))
    : Number(data.readBigInt64LE(PYTH_PREV_TIMESTAMP_OFFSET));

  if (rawPrice <= 0n) return null;

  const age = nowSeconds - publishTime;
  if (age < 0 || age > ORACLE_STALENESS) return null;
  if (confidence > (rawPrice * MAX_CONFIDENCE_BPS) / FEE_DENOMINATOR) return null;

  return exponent >= 0
    ? rawPrice * 10n ** BigInt(exponent) * PRICE_DECIMALS
    : (rawPrice * PRICE_DECIMALS) / 10n ** BigInt(-exponent);
}

/** Decodes resting orders, tagging each with its index within its own side. */
function decodeOrderBook(data: Buffer): { bids: RestingOrder[]; asks: RestingOrder[] } {
  let offset = 8 + 32; // discriminator + market

  const readSide = (count: number): RestingOrder[] => {
    const orders: RestingOrder[] = [];
    for (let i = 0; i < count; i += 1) {
      orders.push({
        index: i,
        owner: new PublicKey(data.subarray(offset, offset + 32)),
        side: data.readUInt8(offset + 32),
        price: data.readBigUInt64LE(offset + 33),
        status: data.readUInt8(offset + 58),
      });
      offset += ORDER_SIZE;
    }
    return orders;
  };

  const asksLength = data.readUInt32LE(offset);
  offset += 4;
  const asks = readSide(asksLength);

  const bidsLength = data.readUInt32LE(offset);
  offset += 4;
  const bids = readSide(bidsLength);

  return { bids, asks };
}

class ApexMarketMaker {
  private connection: Connection;
  private config: MarketMakerConfig;
  private marketPda: PublicKey;
  private orderBookPda: PublicKey;

  constructor(config: MarketMakerConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, "confirmed");

    [this.marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), config.baseMint.toBuffer()],
      config.programId,
    );
    [this.orderBookPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("orderbook"), this.marketPda.toBuffer()],
      config.programId,
    );
  }

  private get canSend(): boolean {
    return this.config.keypair !== null && !this.config.dryRun;
  }

  private requireKeypair(): Keypair {
    if (!this.config.keypair) {
      throw new Error("MM_PRIVATE_KEY is required to sign quotes.");
    }
    return this.config.keypair;
  }

  public async start() {
    console.log("==================================================");
    console.log("💧 ApeX Market Maker");
    console.log(`RPC:        ${this.config.rpcUrl}`);
    console.log(`Program:    ${this.config.programId.toBase58()}`);
    console.log(`Market:     ${this.marketPda.toBase58()}`);
    console.log(
      `Quoter:     ${
        this.config.keypair ? this.config.keypair.publicKey.toBase58() : "<read-only>"
      }`,
    );
    console.log(
      `Quotes:     ${this.config.levels} level(s)/side, ${this.config.spreadBps} bps half-spread, ` +
        `+${this.config.levelStepBps} bps/level, ${this.config.orderNotional} notional @ ${this.config.leverage}x`,
    );
    console.log(`Execution:  ${this.canSend ? "LIVE" : "observe only"}`);
    console.log("==================================================");

    do {
      try {
        await this.requote();
      } catch (err) {
        console.error("❌ Requote cycle failed:", (err as Error).message);
      }

      if (!this.config.runOnce) {
        await new Promise((res) => setTimeout(res, this.config.requoteIntervalMs));
      }
    } while (!this.config.runOnce);

    console.log("🏁 Market maker run complete.");
  }

  private async requote() {
    console.log(`\n[${new Date().toISOString()}] 🔄 Requoting...`);

    const marketInfo = await this.connection.getAccountInfo(this.marketPda);
    if (!marketInfo) {
      console.log("  ⚪ Market not initialized yet; nothing to quote.");
      return;
    }
    const market = decodeMarket(marketInfo.data);

    const oracleInfo = await this.connection.getAccountInfo(market.oracle);
    if (!oracleInfo) {
      console.log("  ⚠️  Oracle account not found; skipping cycle.");
      return;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const oraclePrice = readOraclePrice(oracleInfo.data, nowSeconds);
    if (oraclePrice === null) {
      console.log(
        "  ⚠️  Oracle price unusable (stale or wide confidence). Not quoting against a bad mark.",
      );
      return;
    }
    console.log(`  Oracle mark: ${Number(oraclePrice) / Number(PRICE_DECIMALS)}`);

    // Cancel our stale quotes before posting fresh ones so we never hold
    // resting liquidity anchored to an old price.
    await this.cancelOwnOrders(market);
    await this.postQuotes(market, oraclePrice);
  }

  /** Cancels every resting order owned by this bot. */
  private async cancelOwnOrders(market: MarketState) {
    if (!this.config.keypair) return;

    const orderBookInfo = await this.connection.getAccountInfo(this.orderBookPda);
    if (!orderBookInfo) return;

    const { bids, asks } = decodeOrderBook(orderBookInfo.data);
    const me = this.config.keypair.publicKey;

    const mineBids = bids.filter((o) => o.owner.equals(me) && o.status === 0);
    const mineAsks = asks.filter((o) => o.owner.equals(me) && o.status === 0);
    if (mineBids.length === 0 && mineAsks.length === 0) return;

    console.log(`  🧹 Cancelling ${mineBids.length} bid(s) and ${mineAsks.length} ask(s)`);

    // Cancel highest index first: the program removes by index, so descending
    // order keeps the remaining indices valid as we go.
    const targets = [
      ...mineBids.map((o) => ({ order: o, side: SIDE_LONG })),
      ...mineAsks.map((o) => ({ order: o, side: SIDE_SHORT })),
    ].sort((a, b) => b.order.index - a.order.index);

    for (const target of targets) {
      const instruction = this.buildCancelOrderInstruction(
        market,
        target.order.index,
        target.side,
      );
      await this.send([instruction], `cancel_order idx=${target.order.index}`);
    }
  }

  /** Posts a ladder of bids and asks straddling the oracle mark. */
  private async postQuotes(market: MarketState, oraclePrice: bigint) {
    if (!this.config.keypair) {
      console.log("  ⏭️  Read-only mode; not posting quotes.");
      return;
    }

    const orderBookInfo = await this.connection.getAccountInfo(this.orderBookPda);
    if (orderBookInfo) {
      const { bids, asks } = decodeOrderBook(orderBookInfo.data);
      const capacity = MAX_ORDERS - (bids.length + asks.length);
      if (capacity < this.config.levels * 2) {
        console.log(
          `  ⚠️  Order book near capacity (${bids.length + asks.length}/${MAX_ORDERS}); skipping.`,
        );
        return;
      }
    }

    const notional = BigInt(Math.round(this.config.orderNotional * Number(SIZE_DECIMALS)));

    for (let level = 0; level < this.config.levels; level += 1) {
      const offsetBps = BigInt(
        this.config.spreadBps + level * this.config.levelStepBps,
      );

      const bidPrice = (oraclePrice * (FEE_DENOMINATOR - offsetBps)) / FEE_DENOMINATOR;
      const askPrice = (oraclePrice * (FEE_DENOMINATOR + offsetBps)) / FEE_DENOMINATOR;
      if (bidPrice <= 0n) continue;

      await this.send(
        [this.buildPlaceOrderInstruction(market, SIDE_LONG, bidPrice, notional)],
        `place bid L${level + 1} @ ${Number(bidPrice) / Number(PRICE_DECIMALS)}`,
      );
      await this.send(
        [this.buildPlaceOrderInstruction(market, SIDE_SHORT, askPrice, notional)],
        `place ask L${level + 1} @ ${Number(askPrice) / Number(PRICE_DECIMALS)}`,
      );
    }
  }

  private buildPlaceOrderInstruction(
    market: MarketState,
    side: number,
    price: bigint,
    size: bigint,
  ): TransactionInstruction {
    const signer = this.requireKeypair().publicKey;
    const data = Buffer.alloc(26);
    discriminator("place_order").copy(data, 0);
    data.writeUInt8(side, 8);
    data.writeBigUInt64LE(price, 9);
    data.writeBigUInt64LE(size, 17);
    data.writeUInt8(this.config.leverage, 25);

    return new TransactionInstruction({
      programId: this.config.programId,
      keys: [
        { pubkey: signer, isSigner: true, isWritable: true },
        { pubkey: this.marketPda, isSigner: false, isWritable: true },
        { pubkey: this.orderBookPda, isSigner: false, isWritable: true },
        { pubkey: this.deriveMargin(signer), isSigner: false, isWritable: true },
        { pubkey: market.vault, isSigner: false, isWritable: true },
        { pubkey: this.traderTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  private buildCancelOrderInstruction(
    market: MarketState,
    orderIndex: number,
    side: number,
  ): TransactionInstruction {
    const signer = this.requireKeypair().publicKey;
    const data = Buffer.alloc(17);
    discriminator("cancel_order").copy(data, 0);
    data.writeBigUInt64LE(BigInt(orderIndex), 8);
    data.writeUInt8(side, 16);

    return new TransactionInstruction({
      programId: this.config.programId,
      keys: [
        { pubkey: signer, isSigner: true, isWritable: false },
        { pubkey: this.marketPda, isSigner: false, isWritable: false },
        { pubkey: this.orderBookPda, isSigner: false, isWritable: true },
        { pubkey: this.deriveMargin(signer), isSigner: false, isWritable: true },
        { pubkey: market.vault, isSigner: false, isWritable: true },
        { pubkey: this.traderTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });
  }

  /** Cached ATA for the collateral mint, resolved once in `init`. */
  private traderTokenAccount!: PublicKey;

  public async init() {
    if (!this.config.keypair) return;
    this.traderTokenAccount = await getAssociatedTokenAddress(
      this.config.baseMint,
      this.config.keypair.publicKey,
    );
  }

  private deriveMargin(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("margin"), this.marketPda.toBuffer(), owner.toBuffer()],
      this.config.programId,
    );
    return pda;
  }

  private async send(instructions: TransactionInstruction[], label: string) {
    if (!this.canSend) {
      console.log(
        `     ⏭️  [${this.config.dryRun ? "dry-run" : "read-only"}] would ${label}`,
      );
      return;
    }

    const signer = this.requireKeypair();
    const transaction = new Transaction().add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...instructions,
    );

    try {
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [signer],
        { commitment: "confirmed", skipPreflight: false },
      );
      console.log(`     ✅ ${label} → ${signature.slice(0, 8)}…`);
    } catch (err) {
      // Insufficient margin, book full, and races with the keeper are all
      // expected; log and continue rather than crashing the loop.
      console.error(`     ❌ ${label} rejected: ${(err as Error).message}`);
    }
  }
}

async function main() {
  const config = loadConfig();
  const mm = new ApexMarketMaker(config);
  await mm.init();
  await mm.start();
}

main().catch((err) => {
  console.error("Fatal market maker error:", err);
  process.exit(1);
});
