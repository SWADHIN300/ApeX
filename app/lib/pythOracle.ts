/**
 * On-chain Pyth price account decoder.
 *
 * Mirrors the byte-layout parsing in programs/apex_protocol/src/lib.rs
 * so the frontend can read the same oracle price the smart contract uses.
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ── Pyth account layout constants ────────────────────────────────────────────
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

/** Internal precision used by the on-chain protocol (1e6). */
const PRICE_DECIMALS = 1_000_000;

/** Maximum oracle age in seconds before we consider it stale. */
const MAX_STALENESS_SECONDS = 60;

/** Maximum confidence interval as bps of the price (1%). */
const MAX_CONFIDENCE_BPS = 100;
const BPS_DENOMINATOR = 10_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function readU32(data: Buffer, offset: number): number {
  return data.readUInt32LE(offset);
}

function readI32(data: Buffer, offset: number): number {
  return data.readInt32LE(offset);
}

function readU64(data: Buffer, offset: number): bigint {
  if (typeof data.readBigUInt64LE === "function") {
    return data.readBigUInt64LE(offset);
  }
  const low = BigInt(data.readUInt32LE(offset));
  const high = BigInt(data.readUInt32LE(offset + 4));
  return (high << BigInt(32)) | low;
}

function readI64(data: Buffer, offset: number): bigint {
  if (typeof data.readBigInt64LE === "function") {
    return data.readBigInt64LE(offset);
  }
  const low = BigInt(data.readUInt32LE(offset));
  const high = BigInt(data.readInt32LE(offset + 4));
  return (high << BigInt(32)) | low;
}

function readU8(data: Buffer, offset: number): number {
  return data.readUInt8(offset);
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface OraclePrice {
  /** Human-readable price (e.g. 65432.10). */
  price: number;
  /** Raw on-chain price scaled by PRICE_DECIMALS. */
  rawPrice: bigint;
  /** Confidence interval in human units. */
  confidence: number;
  /** Unix timestamp of the price publish. */
  publishTime: number;
  /** Whether the oracle is actively trading. */
  isTrading: boolean;
  /** Whether the data passes staleness and confidence checks. */
  isValid: boolean;
}

// ── Core decoder ─────────────────────────────────────────────────────────────

/**
 * Decode a Pyth price account from raw on-chain data.
 * Returns null if the data doesn't look like a valid Pyth price account.
 */
export function decodePythPriceAccount(data: Buffer): OraclePrice | null {
  if (data.length < PYTH_AGG_STATUS_OFFSET + 1) return null;

  const magic = readU32(data, 0);
  const version = readU32(data, 4);
  const accountType = readU32(data, 8);

  if (magic !== PYTH_MAGIC || version !== PYTH_VERSION_2 || accountType !== PYTH_PRICE_ACCOUNT_TYPE) {
    return null;
  }

  const exponent = readI32(data, PYTH_EXPO_OFFSET);
  const timestamp = readI64(data, PYTH_TIMESTAMP_OFFSET);
  const prevPrice = readI64(data, PYTH_PREV_PRICE_OFFSET);
  const prevConf = readU64(data, PYTH_PREV_CONF_OFFSET);
  const prevTimestamp = readI64(data, PYTH_PREV_TIMESTAMP_OFFSET);
  const aggPrice = readI64(data, PYTH_AGG_PRICE_OFFSET);
  const aggConf = readU64(data, PYTH_AGG_CONF_OFFSET);
  const aggStatus = readU8(data, PYTH_AGG_STATUS_OFFSET);

  const isTrading = aggStatus === PYTH_STATUS_TRADING;

  // Use aggregate price if trading, otherwise fall back to previous
  const rawSignedPrice = isTrading ? aggPrice : prevPrice;
  const rawConf = isTrading ? aggConf : prevConf;
  const publishTime = Number(isTrading ? timestamp : prevTimestamp);

  // Check validity
  const now = Math.floor(Date.now() / 1000);
  const age = now - publishTime;
  const pricePositive = rawSignedPrice > BigInt(0);
  const notStale = age >= 0 && age <= MAX_STALENESS_SECONDS;

  const priceAbs = pricePositive ? Number(rawSignedPrice) : 0;
  const maxConf = Math.floor((priceAbs * MAX_CONFIDENCE_BPS) / BPS_DENOMINATOR);
  const confOk = Number(rawConf) <= maxConf;

  const isValid = pricePositive && notStale && confOk;

  // Normalize to human-readable price
  const normalizedPrice = normalizePythPrice(priceAbs, exponent);
  const normalizedConf = normalizePythPrice(Number(rawConf), exponent);

  // Also compute the raw protocol-scaled price
  const rawProtocolPrice = normalizePythPriceRaw(BigInt(priceAbs), exponent);

  return {
    price: normalizedPrice,
    rawPrice: rawProtocolPrice,
    confidence: normalizedConf,
    publishTime,
    isTrading,
    isValid,
  };
}

function normalizePythPrice(rawPrice: number, exponent: number): number {
  if (exponent >= 0) {
    return rawPrice * Math.pow(10, exponent);
  }
  return rawPrice / Math.pow(10, Math.abs(exponent));
}

function normalizePythPriceRaw(rawPrice: bigint, exponent: number): bigint {
  if (exponent >= 0) {
    const scale = BigInt(10) ** BigInt(exponent);
    return rawPrice * scale * BigInt(PRICE_DECIMALS);
  }
  const scale = BigInt(10) ** BigInt(Math.abs(exponent));
  return (rawPrice * BigInt(PRICE_DECIMALS)) / scale;
}

// ── Fetcher ──────────────────────────────────────────────────────────────────

/**
 * Fetch the current oracle price from the on-chain Pyth price account.
 * Returns null if the account doesn't exist or isn't a valid Pyth account.
 */
export async function fetchOraclePrice(
  connection: Connection,
  oracleAddress: PublicKey,
): Promise<OraclePrice | null> {
  const account = await connection.getAccountInfo(oracleAddress);
  if (!account) return null;
  return decodePythPriceAccount(account.data as Buffer);
}

/**
 * Subscribe to oracle price changes in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeOraclePrice(
  connection: Connection,
  oracleAddress: PublicKey,
  callback: (price: OraclePrice | null) => void,
): () => void {
  const listenerId = connection.onAccountChange(
    oracleAddress,
    (account) => {
      callback(decodePythPriceAccount(account.data as Buffer));
    },
    "confirmed",
  );

  return () => {
    void connection.removeAccountChangeListener(listenerId);
  };
}
