/**
 * ApeX Perpetual DEX Autonomous Keeper Service
 *
 * Monitors on-chain protocol markets and *executes* the maintenance
 * instructions the protocol depends on:
 *   1. match_orders        — crosses resting bids/asks into positions
 *   2. liquidate           — closes positions past their liquidation price
 *   3. update_funding_rate — settles funding once per interval
 *
 * Account layouts below are derived from programs/apex_protocol/src/state and
 * are asserted against the on-chain account size before use, so a program
 * redeploy that changes a struct fails loudly instead of silently reading
 * the wrong field.
 */

import { createHash } from "crypto";
import { utils as anchorUtils } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as dotenv from "dotenv";

dotenv.config();

const DEFAULT_PROGRAM_ID = "E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s";

// ── Protocol constants (mirror programs/apex_protocol/src/constants.rs) ──────
const FUNDING_INTERVAL = 28_800; // 8 hours, seconds
const PRICE_DECIMALS = 1_000_000n;
const ORACLE_STALENESS = 60; // seconds
const MAX_CONFIDENCE_BPS = 100n;
const FEE_DENOMINATOR = 10_000n;
const MAX_FUNDING_ACCOUNTS = 32;
const MAX_ABS_PYTH_EXPONENT = 12;

// ── Account sizes (8-byte Anchor discriminator + payload) ───────────────────
const MARKET_ACCOUNT_SIZE = 8 + 193;
const POSITION_ACCOUNT_SIZE = 8 + 131;
const ORDER_SIZE = 67;

// ── Market field offsets ────────────────────────────────────────────────────
const MARKET_AUTHORITY_OFFSET = 8;
const MARKET_ORACLE_OFFSET = 40;
const MARKET_VAULT_OFFSET = 72;
const MARKET_BASE_MINT_OFFSET = 104;
const MARKET_OPEN_INTEREST_LONG_OFFSET = 160;
const MARKET_OPEN_INTEREST_SHORT_OFFSET = 168;
const MARKET_FUNDING_RATE_OFFSET = 176;
/**
 * NOTE: this previously read offset 160, which is `open_interest_long`, not
 * `last_funding_ts`. Funding was therefore evaluated against an unrelated
 * number and would fire (or never fire) arbitrarily.
 */
const MARKET_LAST_FUNDING_TS_OFFSET = 184;

// ── Position field offsets ──────────────────────────────────────────────────
const POSITION_OWNER_OFFSET = 8;
const POSITION_MARKET_OFFSET = 40;
const POSITION_SIDE_OFFSET = 72;
const POSITION_COLLATERAL_OFFSET = 73;
const POSITION_NOTIONAL_OFFSET = 81;
const POSITION_SIZE_OFFSET = 89;
const POSITION_ENTRY_PRICE_OFFSET = 97;
const POSITION_LEVERAGE_OFFSET = 105;
const POSITION_LIQUIDATION_PRICE_OFFSET = 106;

// ── Pyth price account offsets ──────────────────────────────────────────────
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

type Side = "Long" | "Short";

interface KeeperConfig {
  rpcUrl: string;
  programId: PublicKey;
  keeperKeypair: Keypair | null;
  baseMints: PublicKey[];
  pollIntervalMs: number;
  runOnce: boolean;
  dryRun: boolean;
}

interface MarketState {
  authority: PublicKey;
  oracle: PublicKey;
  vault: PublicKey;
  baseMint: PublicKey;
  openInterestLong: bigint;
  openInterestShort: bigint;
  fundingRate: bigint;
  lastFundingTs: number;
}

interface PositionState {
  address: PublicKey;
  owner: PublicKey;
  side: Side;
  collateral: bigint;
  notional: bigint;
  size: bigint;
  entryPrice: bigint;
  leverage: number;
  liquidationPrice: bigint;
}

interface OrderState {
  owner: PublicKey;
  side: number;
  price: bigint;
  size: bigint;
  lockedCollateral: bigint;
  leverage: number;
  status: number;
}

/** Anchor instruction discriminator: first 8 bytes of sha256("global:<name>"). */
function discriminator(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

function loadConfig(): KeeperConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const programId = new PublicKey(
    process.env.APEX_PROTOCOL_PROGRAM_ID || DEFAULT_PROGRAM_ID
  );

  // A keeper with no key can still observe, but must never silently pretend to
  // be operational with a throwaway account that holds no SOL and is not the
  // market authority.
  let keeperKeypair: Keypair | null = null;
  const rawKey = process.env.KEEPER_PRIVATE_KEY;
  if (!rawKey) {
    console.warn(
      "⚠️  KEEPER_PRIVATE_KEY is not set — starting in READ-ONLY mode. No transactions will be sent."
    );
  } else {
    keeperKeypair = parseKeypair(rawKey);
  }

  const rawMints = process.env.MARKET_BASE_MINTS;
  let baseMints: PublicKey[] = [];
  if (rawMints) {
    try {
      const parsed = JSON.parse(rawMints) as string[];
      baseMints = parsed.map((m) => new PublicKey(m));
    } catch {
      baseMints = [new PublicKey(rawMints.trim())];
    }
  } else {
    baseMints = [
      new PublicKey(
        process.env.NEXT_PUBLIC_APEX_DEVNET_BASE_MINT ||
          "4zMMC9srt5Ri5X14GVnYj7wAVTJGN1YjBe5HL4s3bQDa"
      ),
    ];
  }

  const parsedInterval = Number.parseInt(process.env.POLL_INTERVAL_MS || "15000", 10);
  const pollIntervalMs =
    Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 15_000;

  return {
    rpcUrl,
    programId,
    keeperKeypair,
    baseMints,
    pollIntervalMs,
    runOnce: process.argv.includes("--once"),
    dryRun: process.argv.includes("--dry-run") || process.env.DRY_RUN === "true",
  };
}

/**
 * Parses a keypair from a JSON byte array or a base58 secret key. Throws rather
 * than falling back to a random keypair — a keeper running under the wrong
 * identity fails every instruction and looks like a protocol outage.
 */
function parseKeypair(rawKey: string): Keypair {
  const trimmed = rawKey.trim();
  try {
    if (trimmed.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(trimmed) as number[]));
    }
    return Keypair.fromSecretKey(Uint8Array.from(anchorUtils.bytes.bs58.decode(trimmed)));
  } catch (err) {
    throw new Error(
      `KEEPER_PRIVATE_KEY could not be parsed as a JSON byte array or base58 secret key: ${
        (err as Error).message
      }`
    );
  }
}

function decodeMarket(data: Buffer): MarketState {
  if (data.length !== MARKET_ACCOUNT_SIZE) {
    throw new Error(
      `Unexpected Market account size ${data.length}, expected ${MARKET_ACCOUNT_SIZE}. ` +
        `The deployed program's Market struct does not match this keeper build.`
    );
  }

  return {
    authority: new PublicKey(
      data.subarray(MARKET_AUTHORITY_OFFSET, MARKET_AUTHORITY_OFFSET + 32)
    ),
    oracle: new PublicKey(data.subarray(MARKET_ORACLE_OFFSET, MARKET_ORACLE_OFFSET + 32)),
    vault: new PublicKey(data.subarray(MARKET_VAULT_OFFSET, MARKET_VAULT_OFFSET + 32)),
    baseMint: new PublicKey(
      data.subarray(MARKET_BASE_MINT_OFFSET, MARKET_BASE_MINT_OFFSET + 32)
    ),
    openInterestLong: data.readBigUInt64LE(MARKET_OPEN_INTEREST_LONG_OFFSET),
    openInterestShort: data.readBigUInt64LE(MARKET_OPEN_INTEREST_SHORT_OFFSET),
    fundingRate: data.readBigInt64LE(MARKET_FUNDING_RATE_OFFSET),
    lastFundingTs: Number(data.readBigInt64LE(MARKET_LAST_FUNDING_TS_OFFSET)),
  };
}

function decodePosition(address: PublicKey, data: Buffer): PositionState | null {
  if (data.length !== POSITION_ACCOUNT_SIZE) return null;

  const size = data.readBigUInt64LE(POSITION_SIZE_OFFSET);
  if (size === 0n) return null; // closed / uninitialized

  return {
    address,
    owner: new PublicKey(data.subarray(POSITION_OWNER_OFFSET, POSITION_OWNER_OFFSET + 32)),
    side: data.readUInt8(POSITION_SIDE_OFFSET) === 0 ? "Long" : "Short",
    collateral: data.readBigUInt64LE(POSITION_COLLATERAL_OFFSET),
    notional: data.readBigUInt64LE(POSITION_NOTIONAL_OFFSET),
    size,
    entryPrice: data.readBigUInt64LE(POSITION_ENTRY_PRICE_OFFSET),
    leverage: data.readUInt8(POSITION_LEVERAGE_OFFSET),
    liquidationPrice: data.readBigUInt64LE(POSITION_LIQUIDATION_PRICE_OFFSET),
  };
}

function decodeOrder(data: Buffer, offset: number): OrderState {
  return {
    owner: new PublicKey(data.subarray(offset, offset + 32)),
    side: data.readUInt8(offset + 32),
    price: data.readBigUInt64LE(offset + 33),
    size: data.readBigUInt64LE(offset + 41),
    lockedCollateral: data.readBigUInt64LE(offset + 49),
    leverage: data.readUInt8(offset + 57),
    status: data.readUInt8(offset + 58),
  };
}

/** Decodes the two price-sorted order vectors out of the OrderBook account. */
function decodeOrderBook(data: Buffer): { bids: OrderState[]; asks: OrderState[] } {
  let offset = 8 + 32; // discriminator + market pubkey

  const asksLength = data.readUInt32LE(offset);
  offset += 4;
  const asks: OrderState[] = [];
  for (let i = 0; i < asksLength; i += 1) {
    asks.push(decodeOrder(data, offset));
    offset += ORDER_SIZE;
  }

  const bidsLength = data.readUInt32LE(offset);
  offset += 4;
  const bids: OrderState[] = [];
  for (let i = 0; i < bidsLength; i += 1) {
    bids.push(decodeOrder(data, offset));
    offset += ORDER_SIZE;
  }

  return { bids, asks };
}

/**
 * Mirrors `get_oracle_price` in the program: validates the Pyth header,
 * staleness and confidence, then normalizes to 6 decimals. Returning null means
 * the program would also reject this price, so the keeper must not act on it.
 */
function readOraclePrice(data: Buffer, nowSeconds: number): bigint | null {
  if (data.length < PYTH_AGG_STATUS_OFFSET + 1) return null;
  if (data.readUInt32LE(0) !== PYTH_MAGIC) return null;
  if (data.readUInt32LE(4) !== PYTH_VERSION_2) return null;
  if (data.readUInt32LE(8) !== PYTH_PRICE_ACCOUNT_TYPE) return null;

  const exponent = data.readInt32LE(PYTH_EXPO_OFFSET);
  if (Math.abs(exponent) > MAX_ABS_PYTH_EXPONENT) return null;

  const status = data.readUInt8(PYTH_AGG_STATUS_OFFSET);
  const trading = status === PYTH_STATUS_TRADING;
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

  const maxConfidence = (rawPrice * MAX_CONFIDENCE_BPS) / FEE_DENOMINATOR;
  if (confidence > maxConfidence) return null;

  if (exponent >= 0) {
    return rawPrice * 10n ** BigInt(exponent) * PRICE_DECIMALS;
  }
  return (rawPrice * PRICE_DECIMALS) / 10n ** BigInt(-exponent);
}

class ApexKeeper {
  private connection: Connection;
  private config: KeeperConfig;

  constructor(config: KeeperConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, "confirmed");
  }

  private get canSend(): boolean {
    return this.config.keeperKeypair !== null && !this.config.dryRun;
  }

  public async start() {
    const keeperAddress = this.config.keeperKeypair
      ? this.config.keeperKeypair.publicKey.toBase58()
      : "<read-only>";

    console.log("==================================================");
    console.log("🚀 ApeX Perpetual DEX Keeper Service");
    console.log(`RPC:          ${this.config.rpcUrl}`);
    console.log(`Program ID:   ${this.config.programId.toBase58()}`);
    console.log(`Keeper:       ${keeperAddress}`);
    console.log(`Markets:      ${this.config.baseMints.length}`);
    console.log(`Mode:         ${this.config.runOnce ? "single run" : "continuous"}`);
    console.log(`Execution:    ${this.canSend ? "LIVE" : "observe only"}`);
    console.log("==================================================");

    do {
      try {
        await this.runIteration();
      } catch (err) {
        console.error("❌ Keeper iteration failed:", err);
      }

      if (!this.config.runOnce) {
        await new Promise((res) => setTimeout(res, this.config.pollIntervalMs));
      }
    } while (!this.config.runOnce);

    console.log("🏁 Keeper run complete.");
  }

  private async runIteration() {
    console.log(`\n[${new Date().toISOString()}] 🔍 Scanning markets...`);
    for (const baseMint of this.config.baseMints) {
      try {
        await this.processMarket(baseMint);
      } catch (err) {
        console.error(`  ❌ Market ${baseMint.toBase58()} failed:`, (err as Error).message);
      }
    }
  }

  private async processMarket(baseMint: PublicKey) {
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), baseMint.toBuffer()],
      this.config.programId
    );
    const [orderBookPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("orderbook"), marketPda.toBuffer()],
      this.config.programId
    );

    const marketInfo = await this.connection.getAccountInfo(marketPda);
    if (!marketInfo) {
      console.log(`  ⚪ Market ${marketPda.toBase58()} not initialized.`);
      return;
    }

    const market = decodeMarket(marketInfo.data);
    console.log(`  📊 Market ${marketPda.toBase58()} (mint ${baseMint.toBase58()})`);

    const oracleInfo = await this.connection.getAccountInfo(market.oracle);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const markPrice = oracleInfo ? readOraclePrice(oracleInfo.data, nowSeconds) : null;

    if (markPrice === null) {
      console.log(
        "     ⚠️  Oracle price unusable (stale, wide confidence, or not a Pyth account). " +
          "Skipping liquidations; the program would reject them anyway."
      );
    } else {
      console.log(`     Mark price: ${Number(markPrice) / Number(PRICE_DECIMALS)}`);
    }

    await this.matchOrders(marketPda, orderBookPda, market);
    if (markPrice !== null) {
      await this.liquidatePositions(marketPda, market, markPrice);
    }
    await this.settleFunding(marketPda, market, nowSeconds);
  }

  // ── 1. Order matching ─────────────────────────────────────────────────────
  private async matchOrders(
    marketPda: PublicKey,
    orderBookPda: PublicKey,
    market: MarketState
  ) {
    const orderBookInfo = await this.connection.getAccountInfo(orderBookPda);
    if (!orderBookInfo) return;

    const { bids, asks } = decodeOrderBook(orderBookInfo.data);
    const bestBid = bids.find((o) => o.status === 0);
    const bestAsk = asks.find((o) => o.status === 0);

    if (!bestBid || !bestAsk) {
      console.log(`     Book: ${bids.length} bids / ${asks.length} asks — nothing to cross.`);
      return;
    }
    if (bestAsk.price > bestBid.price) {
      console.log("     Book: spread not crossed.");
      return;
    }
    // The program rejects self-trades, so don't waste a transaction on one.
    if (bestBid.owner.equals(bestAsk.owner)) {
      console.log("     ⚠️  Top of book is a self-trade; program would reject. Skipping.");
      return;
    }

    console.log(
      `     🔄 Crossing bid ${bestBid.price} vs ask ${bestAsk.price} — submitting match_orders`
    );

    const instruction = this.buildMatchOrdersInstruction(
      marketPda,
      orderBookPda,
      market,
      bestBid.owner,
      bestAsk.owner
    );
    await this.send([instruction], "match_orders");
  }

  private buildMatchOrdersInstruction(
    marketPda: PublicKey,
    orderBookPda: PublicKey,
    market: MarketState,
    bidOwner: PublicKey,
    askOwner: PublicKey
  ): TransactionInstruction {
    const keeper = this.requireKeeper();
    const bidMargin = this.deriveMargin(marketPda, bidOwner);
    const askMargin = this.deriveMargin(marketPda, askOwner);
    const bidPosition = this.derivePosition(marketPda, bidOwner);
    const askPosition = this.derivePosition(marketPda, askOwner);

    return new TransactionInstruction({
      programId: this.config.programId,
      keys: [
        { pubkey: keeper.publicKey, isSigner: true, isWritable: true },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: orderBookPda, isSigner: false, isWritable: true },
        { pubkey: bidOwner, isSigner: false, isWritable: false },
        { pubkey: askOwner, isSigner: false, isWritable: false },
        { pubkey: bidMargin, isSigner: false, isWritable: true },
        { pubkey: askMargin, isSigner: false, isWritable: true },
        { pubkey: bidPosition, isSigner: false, isWritable: true },
        { pubkey: askPosition, isSigner: false, isWritable: true },
        { pubkey: market.vault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator("match_orders"),
    });
  }

  // ── 2. Liquidations ───────────────────────────────────────────────────────
  private async liquidatePositions(
    marketPda: PublicKey,
    market: MarketState,
    markPrice: bigint
  ) {
    const accounts = await this.connection.getProgramAccounts(this.config.programId, {
      filters: [
        { dataSize: POSITION_ACCOUNT_SIZE },
        { memcmp: { offset: POSITION_MARKET_OFFSET, bytes: marketPda.toBase58() } },
      ],
    });

    const positions = accounts
      .map(({ pubkey, account }) => decodePosition(pubkey, account.data as Buffer))
      .filter((p): p is PositionState => p !== null);

    if (positions.length === 0) return;

    const liquidatable = positions.filter((p) =>
      p.side === "Long" ? markPrice <= p.liquidationPrice : markPrice >= p.liquidationPrice
    );

    console.log(
      `     🛡️  ${positions.length} open position(s), ${liquidatable.length} liquidatable`
    );

    for (const position of liquidatable) {
      console.log(
        `     ⚡ Liquidating ${position.owner.toBase58()} (${position.side}, liq ${
          position.liquidationPrice
        })`
      );
      try {
        const instruction = await this.buildLiquidateInstruction(marketPda, market, position);
        await this.send([instruction], `liquidate ${position.owner.toBase58()}`);
      } catch (err) {
        console.error(`     ❌ Liquidation failed: ${(err as Error).message}`);
      }
    }
  }

  private async buildLiquidateInstruction(
    marketPda: PublicKey,
    market: MarketState,
    position: PositionState
  ): Promise<TransactionInstruction> {
    const keeper = this.requireKeeper();
    const keeperTokenAccount = await getAssociatedTokenAddress(
      market.baseMint,
      keeper.publicKey
    );
    const traderMargin = this.deriveMargin(marketPda, position.owner);

    return new TransactionInstruction({
      programId: this.config.programId,
      keys: [
        { pubkey: keeper.publicKey, isSigner: true, isWritable: true },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: position.address, isSigner: false, isWritable: true },
        { pubkey: traderMargin, isSigner: false, isWritable: true },
        { pubkey: market.vault, isSigner: false, isWritable: true },
        { pubkey: keeperTokenAccount, isSigner: false, isWritable: true },
        { pubkey: market.oracle, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: discriminator("liquidate"),
    });
  }

  // ── 3. Funding settlement ─────────────────────────────────────────────────
  private async settleFunding(
    marketPda: PublicKey,
    market: MarketState,
    nowSeconds: number
  ) {
    const dueAt = market.lastFundingTs + FUNDING_INTERVAL;
    if (nowSeconds < dueAt) {
      const minutes = Math.ceil((dueAt - nowSeconds) / 60);
      console.log(`     ⏱️  Funding due in ~${minutes} min.`);
      return;
    }

    // update_funding_rate is authority-gated (`has_one = authority`), so a
    // keeper that is not the market authority cannot settle funding.
    const keeper = this.config.keeperKeypair;
    if (!keeper) {
      console.log("     ⏱️  Funding is due but keeper is read-only.");
      return;
    }
    if (!keeper.publicKey.equals(market.authority)) {
      console.warn(
        `     ⚠️  Funding is due but keeper ${keeper.publicKey.toBase58()} is not the market ` +
          `authority ${market.authority.toBase58()}. Configure the authority key to settle funding.`
      );
      return;
    }

    // Settle the open positions in this market, bounded by the program's cap.
    const accounts = await this.connection.getProgramAccounts(this.config.programId, {
      filters: [
        { dataSize: POSITION_ACCOUNT_SIZE },
        { memcmp: { offset: POSITION_MARKET_OFFSET, bytes: marketPda.toBase58() } },
      ],
    });
    const positionKeys = accounts
      .map(({ pubkey, account }) => decodePosition(pubkey, account.data as Buffer))
      .filter((p): p is PositionState => p !== null)
      .slice(0, MAX_FUNDING_ACCOUNTS)
      .map((p) => p.address);

    console.log(
      `     ⏱️  Settling funding across ${positionKeys.length} position(s) (cap ${MAX_FUNDING_ACCOUNTS}).`
    );

    const instruction = new TransactionInstruction({
      programId: this.config.programId,
      keys: [
        { pubkey: keeper.publicKey, isSigner: true, isWritable: false },
        { pubkey: marketPda, isSigner: false, isWritable: true },
        { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
        ...positionKeys.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: true,
        })),
      ],
      data: discriminator("update_funding_rate"),
    });

    await this.send([instruction], "update_funding_rate");
  }

  // ── Transaction plumbing ──────────────────────────────────────────────────
  private requireKeeper(): Keypair {
    if (!this.config.keeperKeypair) {
      throw new Error("KEEPER_PRIVATE_KEY is required to build signed instructions.");
    }
    return this.config.keeperKeypair;
  }

  private async send(instructions: TransactionInstruction[], label: string) {
    if (!this.canSend) {
      console.log(`     ⏭️  [${this.config.dryRun ? "dry-run" : "read-only"}] would send ${label}`);
      return;
    }

    const keeper = this.requireKeeper();
    const transaction = new Transaction().add(
      // Order book operations touch a large account; request headroom explicitly.
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...instructions
    );

    try {
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [keeper],
        { commitment: "confirmed", skipPreflight: false }
      );
      console.log(`     ✅ ${label} confirmed: ${signature}`);
    } catch (err) {
      // Expected-and-benign rejections (race with another keeper, position
      // became healthy, funding already settled) should not look like crashes.
      console.error(`     ❌ ${label} rejected: ${(err as Error).message}`);
    }
  }

  private deriveMargin(market: PublicKey, owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("margin"), market.toBuffer(), owner.toBuffer()],
      this.config.programId
    );
    return pda;
  }

  private derivePosition(market: PublicKey, owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), market.toBuffer(), owner.toBuffer()],
      this.config.programId
    );
    return pda;
  }
}

// ── Entrypoint ───────────────────────────────────────────────────────────────
function main() {
  const config = loadConfig();
  const keeper = new ApexKeeper(config);
  keeper.start().catch((err) => {
    console.error("Fatal keeper error:", err);
    process.exit(1);
  });
}

main();
