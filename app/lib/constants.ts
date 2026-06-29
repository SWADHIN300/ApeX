/**
 * Shared constants — mirrored from the on-chain Rust program
 * (programs/apex_protocol/src/constants.rs).
 *
 * Keep this file in sync with the protocol whenever constants change.
 */

// ── App ──────────────────────────────────────────────────────────────────────
export const APP_NAME = "ApeX";

// ── Leverage ─────────────────────────────────────────────────────────────────
export const MAX_LEVERAGE = 10;
export const MIN_LEVERAGE = 1;
export const LEVERAGE_PRESETS = [1, 2, 5, 10] as const;

// ── Fee / Margin ─────────────────────────────────────────────────────────────
export const FEE_DENOMINATOR = 10_000;
/** Default fee rate in basis points (4 bps = 0.04 %) */
export const DEFAULT_FEE_RATE_BPS = 4;
/** Fee rate as a decimal fraction for quick frontend math */
export const FEE_RATE = DEFAULT_FEE_RATE_BPS / FEE_DENOMINATOR;
/** Maintenance margin in basis points */
export const MAINTENANCE_MARGIN_BPS = 500;
/** Maintenance margin as a decimal fraction */
export const MAINTENANCE_MARGIN = MAINTENANCE_MARGIN_BPS / FEE_DENOMINATOR;
/** Liquidation fee in basis points */
export const LIQUIDATION_FEE_BPS = 50;

// ── Price / Size encoding ────────────────────────────────────────────────────
export const PRICE_DECIMALS = 1_000_000;
export const SIZE_DECIMALS = 1_000_000;

// ── Order book ───────────────────────────────────────────────────────────────
/**
 * On-chain byte size of a single `Order` struct (Borsh-serialised):
 *   owner (Pubkey)  : 32
 *   side  (enum u8) :  1
 *   price (u64)     :  8
 *   size  (u64)     :  8
 *   locked_collateral (u64): 8
 *   leverage (u8)   :  1
 *   status (enum u8):  1
 *   created_at (i64):  8
 *                    ----
 *   Total           : 67
 */
export const ORDER_SIZE_BYTES = 67;
export const MAX_ORDERS = 500;

// ── Funding ──────────────────────────────────────────────────────────────────
export const FUNDING_INTERVAL = 28_800; // 8 hours in seconds
export const BASE_FUNDING_RATE = 10;

// ── Oracle ───────────────────────────────────────────────────────────────────
export const ORACLE_STALENESS = 60; // seconds
export const MAX_CONFIDENCE_BPS = 100;

// ── Transaction states (frontend-only) ───────────────────────────────────────
export type TxStatus =
  | "idle"
  | "confirming"  // order confirmation modal visible
  | "signing"     // waiting for wallet signature
  | "submitted"   // tx sent to network
  | "confirmed"   // tx confirmed on chain
  | "failed";     // any step failed

