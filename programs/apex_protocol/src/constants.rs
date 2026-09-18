pub const MAX_LEVERAGE: u8 = 10;
pub const MIN_LEVERAGE: u8 = 1;
pub const MAINTENANCE_MARGIN: u64 = 500;
pub const LIQUIDATION_FEE: u64 = 50;
pub const FUNDING_INTERVAL: i64 = 28_800;
pub const ORACLE_STALENESS: u64 = 60;
// Cap is chosen so the whole OrderBook account stays under Solana's 10,240-byte
// inner-instruction realloc limit (2 * MAX_ORDERS * ORDER_SIZE ~= 8.5KB). Larger
// values made `initialize_market` fail everywhere with `InvalidRealloc`, because
// Anchor `init` allocates the book via a CPI that cannot exceed 10,240 bytes.
pub const MAX_ORDERS: usize = 64;
pub const FEE_DENOMINATOR: u64 = 10_000;
pub const PRICE_DECIMALS: u64 = 1_000_000;
pub const MAX_CONFIDENCE_BPS: u64 = 100;
pub const BASE_FUNDING_RATE: i64 = 10;

/// Hard ceiling on the magnitude of a single funding settlement, in bps.
/// Prevents a corrupted or manipulated open-interest imbalance from
/// applying an unbounded PnL adjustment to every open position.
pub const MAX_FUNDING_RATE_BPS: i64 = 100;

/// Maximum allowed deviation between a `match_orders` fill price and the
/// on-chain oracle mark price, in bps. Prevents two colluding orders being
/// crossed at an arbitrary price that manufactures a favourable entry (and
/// moves the book's implied last price) at zero net risk. Only enforced when
/// the oracle account actually carries valid, fresh Pyth data.
pub const MAX_MATCH_PRICE_DEVIATION_BPS: u64 = 500;

/// Upper bound on how many `Position` accounts a single `update_funding_rate`
/// call may settle. Bounds compute usage and keeps the instruction from being
/// used to grind through unrelated accounts.
pub const MAX_FUNDING_ACCOUNTS: usize = 32;

/// Pyth exponents outside this range are rejected rather than trusted. Real
/// feeds sit near -8; anything wildly outside indicates a malformed account.
pub const MAX_ABS_PYTH_EXPONENT: i32 = 12;
