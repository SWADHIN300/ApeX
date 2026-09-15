/**
 * ApeX Protocol Indexer
 *
 * Turns the on-chain program's `OrderFilled` events into a queryable trade tape
 * and OHLCV candles, so the terminal can chart ApeX's *own* market instead of a
 * centralized reference feed.
 *
 * How events are read without an IDL:
 *   Anchor's `emit!` writes a base64 blob to the transaction log prefixed with
 *   "Program data: ". The blob is an 8-byte event discriminator —
 *   sha256("event:<EventName>")[0..8] — followed by the Borsh-encoded fields.
 *   Decoding this directly means the indexer does not depend on `anchor build`
 *   having produced target/idl/apex_protocol.json.
 *
 * Writes go straight to Postgres with the indexer's own credentials. There is
 * deliberately no public HTTP write path for market data.
 */

import { createHash } from "crypto";
import {
  Connection,
  PublicKey,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

const DEFAULT_PROGRAM_ID = "E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s";
const DEFAULT_BASE_MINT = "4zMMC9srt5Ri5X14GVnYj7wAVTJGN1YjBe5HL4s3bQDa";

/** Mirrors PRICE_DECIMALS / SIZE_DECIMALS in the on-chain program. */
const PRICE_DECIMALS = 1_000_000;
const SIZE_DECIMALS = 1_000_000;

const LOG_DATA_PREFIX = "Program data: ";

/** Timeframes kept in sync with app/lib/timeframes.ts. */
const TIMEFRAME_SECONDS: Record<string, number> = {
  "1m": 60,
  "5m": 5 * 60,
  "15m": 15 * 60,
  "1h": 60 * 60,
  "4h": 4 * 60 * 60,
  "1d": 24 * 60 * 60,
};

function bucketStartSeconds(timestampSeconds: number, timeframe: string): number {
  const size = TIMEFRAME_SECONDS[timeframe];
  return Math.floor(timestampSeconds / size) * size;
}

/** Anchor event discriminator: first 8 bytes of sha256("event:<Name>"). */
function eventDiscriminator(name: string): Buffer {
  return createHash("sha256").update(`event:${name}`).digest().subarray(0, 8);
}

const ORDER_FILLED_DISCRIMINATOR = eventDiscriminator("OrderFilled");

interface MarketConfig {
  baseMint: PublicKey;
  marketPda: PublicKey;
  pair: string;
}

interface IndexerConfig {
  rpcUrl: string;
  programId: PublicKey;
  markets: MarketConfig[];
  backfillLimit: number;
  backfillOnly: boolean;
  live: boolean;
}

interface OrderFilledEvent {
  maker: string;
  taker: string;
  /** Human-readable price (quote per base). */
  price: number;
  /** Quote-denominated notional that was filled. */
  notional: number;
}

interface FillRecord extends OrderFilledEvent {
  id: string;
  signature: string;
  market: string;
  pair: string;
  slot: number;
  timestampSeconds: number;
  /** Base-denominated size, derived as notional / price. */
  baseSize: number;
}

function loadConfig(): IndexerConfig {
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  const programId = new PublicKey(
    process.env.APEX_PROTOCOL_PROGRAM_ID || DEFAULT_PROGRAM_ID,
  );

  // MARKET_PAIRS maps a base (collateral) mint to the pair label used by the
  // frontend, e.g. {"4zMM...":"BTC-PERP"}. The OrderFilled event itself carries
  // no market or symbol, so attribution comes from which market PDA the
  // transaction touched.
  let pairsByMint: Record<string, string> = {};
  const rawPairs = process.env.MARKET_PAIRS;
  if (rawPairs) {
    try {
      pairsByMint = JSON.parse(rawPairs) as Record<string, string>;
    } catch {
      console.warn("⚠️  MARKET_PAIRS is not valid JSON; falling back to defaults.");
    }
  }
  if (Object.keys(pairsByMint).length === 0) {
    pairsByMint = {
      [process.env.APEX_BASE_MINT || DEFAULT_BASE_MINT]:
        process.env.APEX_DEFAULT_PAIR || "BTC-PERP",
    };
  }

  const markets: MarketConfig[] = Object.entries(pairsByMint).map(([mint, pair]) => {
    const baseMint = new PublicKey(mint);
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), baseMint.toBuffer()],
      programId,
    );
    return { baseMint, marketPda, pair };
  });

  const parsedLimit = Number.parseInt(process.env.BACKFILL_LIMIT || "1000", 10);

  return {
    rpcUrl,
    programId,
    markets,
    backfillLimit: Number.isFinite(parsedLimit) ? parsedLimit : 1000,
    backfillOnly: process.argv.includes("--backfill-only"),
    live: !process.argv.includes("--backfill-only"),
  };
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for the indexer to persist fills.");
  }

  // Certificate verification stays on unless explicitly disabled, matching the
  // app's Postgres client.
  const ssl =
    process.env.DATABASE_SSL_NO_VERIFY === "true"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: true };

  return new Pool({ connectionString, ssl, max: 5 });
}

/**
 * Extracts OrderFilled events from a transaction's log messages.
 * Returns one entry per matching event, in log order.
 */
export function parseOrderFilledEvents(logs: string[]): OrderFilledEvent[] {
  const events: OrderFilledEvent[] = [];

  for (const line of logs) {
    if (!line.startsWith(LOG_DATA_PREFIX)) continue;

    const payload = line.slice(LOG_DATA_PREFIX.length).trim();
    let decoded: Buffer;
    try {
      decoded = Buffer.from(payload, "base64");
    } catch {
      continue;
    }

    // 8-byte discriminator + maker(32) + taker(32) + fill_price(u64) + size(u64)
    if (decoded.length < 8 + 32 + 32 + 8 + 8) continue;
    if (!decoded.subarray(0, 8).equals(ORDER_FILLED_DISCRIMINATOR)) continue;

    const maker = new PublicKey(decoded.subarray(8, 40)).toBase58();
    const taker = new PublicKey(decoded.subarray(40, 72)).toBase58();
    const fillPrice = decoded.readBigUInt64LE(72);
    const size = decoded.readBigUInt64LE(80);

    const price = Number(fillPrice) / PRICE_DECIMALS;
    const notional = Number(size) / SIZE_DECIMALS;
    if (price <= 0) continue;

    events.push({ maker, taker, price, notional });
  }

  return events;
}

class ApexIndexer {
  private connection: Connection;
  private pool: Pool;
  private config: IndexerConfig;

  constructor(config: IndexerConfig, pool: Pool) {
    this.config = config;
    this.pool = pool;
    this.connection = new Connection(config.rpcUrl, "confirmed");
  }

  public async start() {
    console.log("==================================================");
    console.log("📇 ApeX Protocol Indexer");
    console.log(`RPC:        ${this.config.rpcUrl}`);
    console.log(`Program:    ${this.config.programId.toBase58()}`);
    console.log(`Markets:    ${this.config.markets.length}`);
    for (const market of this.config.markets) {
      console.log(`  • ${market.pair} → ${market.marketPda.toBase58()}`);
    }
    console.log(`Mode:       ${this.config.backfillOnly ? "backfill only" : "backfill + live"}`);
    console.log("==================================================");

    for (const market of this.config.markets) {
      await this.backfillMarket(market);
    }

    if (!this.config.live) {
      console.log("🏁 Backfill complete.");
      await this.pool.end();
      return;
    }

    for (const market of this.config.markets) {
      this.subscribeMarket(market);
    }
    console.log("👂 Listening for live fills. Press Ctrl+C to stop.");
  }

  /** Replays historical transactions that touched a market's PDA. */
  private async backfillMarket(market: MarketConfig) {
    console.log(`\n⏳ Backfilling ${market.pair}...`);

    let signatures: ConfirmedSignatureInfo[] = [];
    try {
      signatures = await this.connection.getSignaturesForAddress(market.marketPda, {
        limit: this.config.backfillLimit,
      });
    } catch (err) {
      console.error(`  ❌ Could not list signatures: ${(err as Error).message}`);
      return;
    }

    if (signatures.length === 0) {
      console.log("  ⚪ No transactions found for this market yet.");
      return;
    }

    // Oldest first so candle `open` values land in the right order.
    signatures.reverse();

    let indexed = 0;
    for (const signatureInfo of signatures) {
      if (signatureInfo.err) continue;

      try {
        const tx = await this.connection.getTransaction(signatureInfo.signature, {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        });

        const logs = tx?.meta?.logMessages;
        if (!logs || logs.length === 0) continue;

        const blockTime = tx?.blockTime ?? signatureInfo.blockTime ?? Math.floor(Date.now() / 1000);
        const count = await this.ingest(
          market,
          signatureInfo.signature,
          logs,
          tx?.slot ?? 0,
          blockTime,
        );
        indexed += count;
      } catch (err) {
        console.warn(
          `  ⚠️  Skipped ${signatureInfo.signature.slice(0, 8)}…: ${(err as Error).message}`,
        );
      }
    }

    console.log(`  ✅ Indexed ${indexed} fill(s) for ${market.pair}.`);
  }

  /** Streams new fills as they land on chain. */
  private subscribeMarket(market: MarketConfig) {
    this.connection.onLogs(
      market.marketPda,
      (logs, context) => {
        if (logs.err) return;
        void this.ingest(
          market,
          logs.signature,
          logs.logs,
          context.slot,
          Math.floor(Date.now() / 1000),
        )
          .then((count) => {
            if (count > 0) {
              console.log(
                `[${new Date().toISOString()}] 📈 ${count} fill(s) on ${market.pair} (${logs.signature.slice(0, 8)}…)`,
              );
            }
          })
          .catch((err) => {
            console.error("  ❌ Ingest failed:", (err as Error).message);
          });
      },
      "confirmed",
    );
  }

  /** Persists every OrderFilled event found in a transaction's logs. */
  private async ingest(
    market: MarketConfig,
    signature: string,
    logs: string[],
    slot: number,
    timestampSeconds: number,
  ): Promise<number> {
    const events = parseOrderFilledEvents(logs);
    if (events.length === 0) return 0;

    let written = 0;
    for (let index = 0; index < events.length; index += 1) {
      const event = events[index];
      const record: FillRecord = {
        ...event,
        id: `${signature}:${index}`,
        signature,
        market: market.marketPda.toBase58(),
        pair: market.pair,
        slot,
        timestampSeconds,
        baseSize: event.notional / event.price,
      };

      const inserted = await this.writeFill(record);
      if (inserted) {
        await this.updateCandles(record);
        written += 1;
      }
    }

    return written;
  }

  /** Returns true when the fill was new (so candles should be updated once). */
  private async writeFill(record: FillRecord): Promise<boolean> {
    const result = await this.pool.query(
      `
        INSERT INTO fills (id, signature, market, pair, maker, taker, price, size, slot, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10))
        ON CONFLICT (id) DO NOTHING
      `,
      [
        record.id,
        record.signature,
        record.market,
        record.pair,
        record.maker,
        record.taker,
        record.price,
        record.baseSize,
        record.slot,
        record.timestampSeconds,
      ],
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Folds a fill into every timeframe's candle bucket. `open` is only set when
   * the bucket is created; later fills extend high/low/close and volume.
   */
  private async updateCandles(record: FillRecord) {
    for (const timeframe of Object.keys(TIMEFRAME_SECONDS)) {
      const bucket = bucketStartSeconds(record.timestampSeconds, timeframe);

      await this.pool.query(
        `
          INSERT INTO candles (pair, timeframe, bucket_start, open, high, low, close, volume, trade_count)
          VALUES ($1, $2, to_timestamp($3), $4, $4, $4, $4, $5, 1)
          ON CONFLICT (pair, timeframe, bucket_start) DO UPDATE SET
            high        = GREATEST(candles.high, EXCLUDED.high),
            low         = LEAST(candles.low, EXCLUDED.low),
            close       = EXCLUDED.close,
            volume      = candles.volume + EXCLUDED.volume,
            trade_count = candles.trade_count + 1
        `,
        [record.pair, timeframe, bucket, record.price, record.baseSize],
      );
    }
  }
}

async function main() {
  const config = loadConfig();
  const pool = createPool();
  const indexer = new ApexIndexer(config, pool);

  const shutdown = async () => {
    console.log("\n🛑 Shutting down indexer...");
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await indexer.start();
}

// Only run when executed directly, so the event parser can be unit tested.
if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal indexer error:", err);
    process.exit(1);
  });
}
