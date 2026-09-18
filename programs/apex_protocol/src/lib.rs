use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

pub use constants::*;
pub use errors::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("D643vETCKW14hgvpmUoWZTYi65R9tijNm1RGmZFfS6g1");

const PYTH_MAGIC: u32 = 0xa1b2c3d4;
const PYTH_VERSION_2: u32 = 2;
const PYTH_PRICE_ACCOUNT: u32 = 3;
const PYTH_STATUS_TRADING: u8 = 1;
const PYTH_EXPO_OFFSET: usize = 20;
const PYTH_TIMESTAMP_OFFSET: usize = 96;
const PYTH_PREV_PRICE_OFFSET: usize = 184;
const PYTH_PREV_CONF_OFFSET: usize = 192;
const PYTH_PREV_TIMESTAMP_OFFSET: usize = 200;
const PYTH_AGG_PRICE_OFFSET: usize = 208;
const PYTH_AGG_CONF_OFFSET: usize = 216;
const PYTH_AGG_STATUS_OFFSET: usize = 224;

#[program]
pub mod apex_protocol {
    use super::*;

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        fee_rate: u64,
        oracle: Pubkey,
    ) -> Result<()> {
        instructions::initialize_market::handler(ctx, fee_rate, oracle)
    }

    pub fn deposit_margin(ctx: Context<DepositMargin>, amount: u64) -> Result<()> {
        instructions::deposit_margin::handler(ctx, amount)
    }

    pub fn withdraw_margin(ctx: Context<WithdrawMargin>, amount: u64) -> Result<()> {
        instructions::withdraw_margin::handler(ctx, amount)
    }

    /// `price_limit` bounds the oracle entry price the caller is willing to
    /// accept (0 disables the check). Long fills require `entry <= price_limit`,
    /// shorts require `entry >= price_limit`.
    pub fn open_position(
        ctx: Context<OpenPosition>,
        side: Side,
        collateral: u64,
        leverage: u8,
        price_limit: u64,
    ) -> Result<()> {
        instructions::open_position::handler(ctx, side, collateral, leverage, price_limit)
    }

    /// `price_limit` bounds the oracle exit price (0 disables the check).
    /// Closing a long requires `exit >= price_limit`, a short `exit <= price_limit`.
    pub fn close_position(ctx: Context<ClosePosition>, price_limit: u64) -> Result<()> {
        instructions::close_position::handler(ctx, price_limit)
    }

    pub fn place_order(
        ctx: Context<PlaceOrder>,
        side: Side,
        price: u64,
        size: u64,
        leverage: u8,
    ) -> Result<()> {
        instructions::place_order::handler(ctx, side, price, size, leverage)
    }

    pub fn cancel_order(ctx: Context<CancelOrder>, order_index: u64, side: Side) -> Result<()> {
        instructions::cancel_order::handler(ctx, order_index, side)
    }

    pub fn match_orders(ctx: Context<MatchOrders>) -> Result<()> {
        instructions::match_orders::handler(ctx)
    }

    /// Seed protocol liquidity so profitable closes can be paid immediately
    /// instead of being deferred forever on a balanced/underfunded book.
    /// `target_liquidity_pool` selects `liquidity_pool` (true) or
    /// `insurance_fund` (false).
    pub fn top_up_liquidity(
        ctx: Context<TopUpLiquidity>,
        amount: u64,
        target_liquidity_pool: bool,
    ) -> Result<()> {
        instructions::top_up_liquidity::handler(ctx, amount, target_liquidity_pool)
    }

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        instructions::liquidate::handler(ctx)
    }

    pub fn update_funding_rate(ctx: Context<UpdateFundingRate>) -> Result<()> {
        instructions::update_funding_rate::handler(ctx)
    }

    /// Withdraw a payout that `close_position` had to defer because protocol
    /// liquidity was momentarily insufficient. Without this, deferred balances
    /// were permanently unrecoverable.
    pub fn claim_pending_payout(ctx: Context<ClaimPendingPayout>) -> Result<()> {
        instructions::claim_pending_payout::handler(ctx)
    }

    // ── Spot markets ────────────────────────────────────────────────────────
    // Order-book spot trading for a base/quote token pair. Settlement moves
    // real tokens between counterparties, so there is no leverage, funding, or
    // liquidation involved.

    pub fn initialize_spot_market(
        ctx: Context<InitializeSpotMarket>,
        fee_rate: u64,
    ) -> Result<()> {
        instructions::initialize_spot_market::handler(ctx, fee_rate)
    }

    pub fn deposit_spot(
        ctx: Context<DepositSpot>,
        base_amount: u64,
        quote_amount: u64,
    ) -> Result<()> {
        instructions::deposit_spot::handler(ctx, base_amount, quote_amount)
    }

    pub fn withdraw_spot(
        ctx: Context<WithdrawSpot>,
        base_amount: u64,
        quote_amount: u64,
    ) -> Result<()> {
        instructions::withdraw_spot::handler(ctx, base_amount, quote_amount)
    }

    /// `Side::Long` buys base with quote, `Side::Short` sells base for quote.
    /// `size` is denominated in base units.
    pub fn place_spot_order(
        ctx: Context<PlaceSpotOrder>,
        side: Side,
        price: u64,
        size: u64,
    ) -> Result<()> {
        instructions::place_spot_order::handler(ctx, side, price, size)
    }

    pub fn cancel_spot_order(
        ctx: Context<CancelSpotOrder>,
        order_index: u64,
        side: Side,
    ) -> Result<()> {
        instructions::cancel_spot_order::handler(ctx, order_index, side)
    }

    pub fn match_spot_orders(ctx: Context<MatchSpotOrders>) -> Result<()> {
        instructions::match_spot_orders::handler(ctx)
    }

    /// Let the spot-market authority withdraw the taker fees accumulated by
    /// `match_spot_orders` out of the quote vault.
    pub fn sweep_spot_fees(ctx: Context<SweepSpotFees>) -> Result<()> {
        instructions::sweep_spot_fees::handler(ctx)
    }
}

pub fn get_oracle_price(oracle_account: &AccountInfo, clock: &Clock) -> Result<u64> {
    let oracle_data = oracle_account.try_borrow_data()?;
    let price_account = read_pyth_price_account(&oracle_data)?;
    let (price, confidence, publish_time) = price_account.current_price();

    require!(price > 0, ApexError::OraclePriceStale);

    let age = clock
        .unix_timestamp
        .checked_sub(publish_time)
        .ok_or(ApexError::OraclePriceStale)?;
    require!(
        age >= 0 && age as u64 <= ORACLE_STALENESS,
        ApexError::OraclePriceStale
    );

    let price_abs = u64::try_from(price).map_err(|_| ApexError::MathOverflow)?;
    let max_conf = u64::try_from(
        (price_abs as u128)
            .checked_mul(MAX_CONFIDENCE_BPS as u128)
            .ok_or(ApexError::MathOverflow)?
            .checked_div(FEE_DENOMINATOR as u128)
            .ok_or(ApexError::MathOverflow)?,
    )
    .map_err(|_| ApexError::MathOverflow)?;
    require!(confidence <= max_conf, ApexError::OraclePriceStale);

    normalize_pyth_price(price_abs, price_account.exponent)
}

/// Converts a raw Pyth price plus its exponent into the protocol's fixed-point
/// representation (6 decimals).
///
/// A Pyth price is `raw * 10^exponent`. Rendering that at `PRICE_DECIMALS`
/// fixed point therefore gives `raw * 10^exponent * PRICE_DECIMALS`, which for
/// negative exponents is evaluated as `raw * PRICE_DECIMALS / 10^|exponent|`
/// to avoid truncating to zero. Both branches are covered by unit tests below.
pub fn normalize_pyth_price(raw_price: u64, exponent: i32) -> Result<u64> {
    require!(
        exponent.abs() <= MAX_ABS_PYTH_EXPONENT,
        ApexError::InvalidOracleExponent
    );

    let normalized = if exponent >= 0 {
        let scale = 10_u128
            .checked_pow(exponent as u32)
            .ok_or(ApexError::MathOverflow)?;
        (raw_price as u128)
            .checked_mul(scale)
            .and_then(|price| price.checked_mul(PRICE_DECIMALS as u128))
            .ok_or(ApexError::MathOverflow)?
    } else {
        let scale = 10_u128
            .checked_pow(exponent.unsigned_abs())
            .ok_or(ApexError::MathOverflow)?;
        (raw_price as u128)
            .checked_mul(PRICE_DECIMALS as u128)
            .and_then(|price| price.checked_div(scale))
            .ok_or(ApexError::MathOverflow)?
    };

    u64::try_from(normalized).map_err(|_| ApexError::MathOverflow.into())
}

struct PythPriceAccount {
    exponent: i32,
    timestamp: i64,
    previous_price: i64,
    previous_confidence: u64,
    previous_timestamp: i64,
    aggregate_price: i64,
    aggregate_confidence: u64,
    aggregate_status: u8,
}

impl PythPriceAccount {
    fn current_price(&self) -> (i64, u64, i64) {
        if self.aggregate_status == PYTH_STATUS_TRADING {
            (
                self.aggregate_price,
                self.aggregate_confidence,
                self.timestamp,
            )
        } else {
            (
                self.previous_price,
                self.previous_confidence,
                self.previous_timestamp,
            )
        }
    }
}

fn read_pyth_price_account(data: &[u8]) -> Result<PythPriceAccount> {
    require!(read_u32(data, 0)? == PYTH_MAGIC, ApexError::InvalidOracle);
    require!(
        read_u32(data, 4)? == PYTH_VERSION_2,
        ApexError::InvalidOracle
    );
    require!(
        read_u32(data, 8)? == PYTH_PRICE_ACCOUNT,
        ApexError::InvalidOracle
    );

    Ok(PythPriceAccount {
        exponent: read_i32(data, PYTH_EXPO_OFFSET)?,
        timestamp: read_i64(data, PYTH_TIMESTAMP_OFFSET)?,
        previous_price: read_i64(data, PYTH_PREV_PRICE_OFFSET)?,
        previous_confidence: read_u64(data, PYTH_PREV_CONF_OFFSET)?,
        previous_timestamp: read_i64(data, PYTH_PREV_TIMESTAMP_OFFSET)?,
        aggregate_price: read_i64(data, PYTH_AGG_PRICE_OFFSET)?,
        aggregate_confidence: read_u64(data, PYTH_AGG_CONF_OFFSET)?,
        aggregate_status: read_u8(data, PYTH_AGG_STATUS_OFFSET)?,
    })
}

fn read_u8(data: &[u8], offset: usize) -> Result<u8> {
    data.get(offset)
        .copied()
        .ok_or(ApexError::InvalidOracle.into())
}

fn read_u32(data: &[u8], offset: usize) -> Result<u32> {
    let bytes = data
        .get(offset..offset + 4)
        .ok_or(ApexError::InvalidOracle)?;
    Ok(u32::from_le_bytes(
        bytes.try_into().map_err(|_| ApexError::InvalidOracle)?,
    ))
}

fn read_i32(data: &[u8], offset: usize) -> Result<i32> {
    let bytes = data
        .get(offset..offset + 4)
        .ok_or(ApexError::InvalidOracle)?;
    Ok(i32::from_le_bytes(
        bytes.try_into().map_err(|_| ApexError::InvalidOracle)?,
    ))
}

fn read_u64(data: &[u8], offset: usize) -> Result<u64> {
    let bytes = data
        .get(offset..offset + 8)
        .ok_or(ApexError::InvalidOracle)?;
    Ok(u64::from_le_bytes(
        bytes.try_into().map_err(|_| ApexError::InvalidOracle)?,
    ))
}

fn read_i64(data: &[u8], offset: usize) -> Result<i64> {
    let bytes = data
        .get(offset..offset + 8)
        .ok_or(ApexError::InvalidOracle)?;
    Ok(i64::from_le_bytes(
        bytes.try_into().map_err(|_| ApexError::InvalidOracle)?,
    ))
}

pub fn validate_leverage(leverage: u8) -> Result<()> {
    require!(
        (MIN_LEVERAGE..=MAX_LEVERAGE).contains(&leverage),
        ApexError::InvalidLeverage
    );
    Ok(())
}

/// Rejects an entry fill whose oracle price is worse than the caller's limit.
/// A `price_limit` of 0 opts out of the check.
pub fn enforce_entry_price_limit(side: &Side, entry_price: u64, price_limit: u64) -> Result<()> {
    if price_limit == 0 {
        return Ok(());
    }
    let acceptable = match side {
        Side::Long => entry_price <= price_limit,
        Side::Short => entry_price >= price_limit,
    };
    require!(acceptable, ApexError::SlippageExceeded);
    Ok(())
}

/// Rejects an exit fill whose oracle price is worse than the caller's limit.
/// A `price_limit` of 0 opts out of the check.
pub fn enforce_exit_price_limit(side: &Side, exit_price: u64, price_limit: u64) -> Result<()> {
    if price_limit == 0 {
        return Ok(());
    }
    let acceptable = match side {
        Side::Long => exit_price >= price_limit,
        Side::Short => exit_price <= price_limit,
    };
    require!(acceptable, ApexError::SlippageExceeded);
    Ok(())
}

pub fn calc_notional(collateral: u64, leverage: u8) -> Result<u64> {
    let notional = (collateral as u128)
        .checked_mul(leverage as u128)
        .ok_or(ApexError::MathOverflow)?;
    u64::try_from(notional).map_err(|_| ApexError::MathOverflow.into())
}

pub fn calc_size(notional: u64, entry_price: u64) -> Result<u64> {
    require!(entry_price > 0, ApexError::OraclePriceStale);
    let size = (notional as u128)
        .checked_mul(PRICE_DECIMALS as u128)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(entry_price as u128)
        .ok_or(ApexError::MathOverflow)?;
    u64::try_from(size).map_err(|_| ApexError::MathOverflow.into())
}

pub fn calc_liquidation_price(entry_price: u64, leverage: u8, side: &Side) -> Result<u64> {
    let leverage_margin = FEE_DENOMINATOR
        .checked_div(leverage as u64)
        .ok_or(ApexError::MathOverflow)?;
    let numerator = match side {
        Side::Long => FEE_DENOMINATOR
            .checked_sub(leverage_margin)
            .and_then(|v| v.checked_add(MAINTENANCE_MARGIN)),
        Side::Short => FEE_DENOMINATOR
            .checked_add(leverage_margin)
            .and_then(|v| v.checked_sub(MAINTENANCE_MARGIN)),
    }
    .ok_or(ApexError::MathOverflow)?;
    u64::try_from(
        (entry_price as u128)
            .checked_mul(numerator as u128)
            .ok_or(ApexError::MathOverflow)?
            .checked_div(FEE_DENOMINATOR as u128)
            .ok_or(ApexError::MathOverflow)?,
    )
    .map_err(|_| ApexError::MathOverflow.into())
}

pub fn calc_pnl(side: &Side, entry_price: u64, mark_price: u64, size: u64) -> Result<i64> {
    let price_delta = match side {
        Side::Long => mark_price as i128 - entry_price as i128,
        Side::Short => entry_price as i128 - mark_price as i128,
    };
    let pnl = price_delta
        .checked_mul(size as i128)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(PRICE_DECIMALS as i128)
        .ok_or(ApexError::MathOverflow)?;
    i64::try_from(pnl).map_err(|_| ApexError::MathOverflow.into())
}

pub fn weighted_average_price(
    current_size: u64,
    current_entry_price: u64,
    added_size: u64,
    added_entry_price: u64,
) -> Result<u64> {
    let total_size = (current_size as u128)
        .checked_add(added_size as u128)
        .ok_or(ApexError::MathOverflow)?;
    require!(total_size > 0, ApexError::MathOverflow);

    let weighted_value = (current_size as u128)
        .checked_mul(current_entry_price as u128)
        .and_then(|value| {
            value.checked_add((added_size as u128).checked_mul(added_entry_price as u128)?)
        })
        .ok_or(ApexError::MathOverflow)?;

    u64::try_from(
        weighted_value
            .checked_div(total_size)
            .ok_or(ApexError::MathOverflow)?,
    )
    .map_err(|_| ApexError::MathOverflow.into())
}

pub fn calc_effective_leverage(collateral: u64, notional: u64) -> Result<u8> {
    require!(collateral > 0, ApexError::InsufficientCollateral);
    let leverage = (notional as u128)
        .checked_add(collateral as u128 - 1)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(collateral as u128)
        .ok_or(ApexError::MathOverflow)?;
    let leverage = u8::try_from(leverage).map_err(|_| ApexError::MathOverflow)?;
    validate_leverage(leverage)?;
    Ok(leverage)
}

/// Quote cost of filling `size` base units at `price`.
///
/// Rounds **up** so the protocol never under-collects from a buyer: a buyer
/// must always reserve at least what the fill actually costs, otherwise a
/// rounding remainder would be paid out of the pooled vault.
pub fn spot_quote_amount(price: u64, size: u64) -> Result<u64> {
    require!(price > 0 && size > 0, ApexError::InvalidSpotOrder);
    let numerator = (price as u128)
        .checked_mul(size as u128)
        .ok_or(ApexError::MathOverflow)?;
    let rounded_up = numerator
        .checked_add(PRICE_DECIMALS as u128 - 1)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(PRICE_DECIMALS as u128)
        .ok_or(ApexError::MathOverflow)?;
    u64::try_from(rounded_up).map_err(|_| ApexError::MathOverflow.into())
}

/// Taker fee on a quote amount, rounded down so it can never exceed the
/// proceeds it is deducted from.
pub fn spot_fee(quote_amount: u64, fee_rate_bps: u64) -> Result<u64> {
    let fee = (quote_amount as u128)
        .checked_mul(fee_rate_bps as u128)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(FEE_DENOMINATOR as u128)
        .ok_or(ApexError::MathOverflow)?;
    let fee = u64::try_from(fee).map_err(|_| ApexError::MathOverflow)?;
    // Defensive: a fee must never consume the entire fill.
    require!(fee <= quote_amount, ApexError::MathOverflow);
    Ok(fee)
}

/// Bounds a computed funding rate to +/- `MAX_FUNDING_RATE_BPS` so a single
/// settlement can never apply an unbounded adjustment to open positions.
pub fn clamp_funding_rate(rate: i64) -> i64 {
    rate.clamp(-MAX_FUNDING_RATE_BPS, MAX_FUNDING_RATE_BPS)
}

pub fn market_signer_seeds<'a>(base_mint: &'a Pubkey, bump: &'a u8) -> [&'a [u8]; 3] {
    [b"market", base_mint.as_ref(), std::slice::from_ref(bump)]
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Oracle normalization ────────────────────────────────────────────────
    // Pyth publishes price = raw * 10^exponent. The protocol stores prices at
    // 6 decimals, so BTC at $65,000.12345678 with exponent -8 must land on
    // 65_000_123_456 (i.e. 65000.123456 * 1e6).

    #[test]
    fn normalizes_typical_negative_exponent() {
        // 65_000.12345678 with expo -8
        let raw = 6_500_012_345_678_u64;
        assert_eq!(normalize_pyth_price(raw, -8).unwrap(), 65_000_123_456);
    }

    #[test]
    fn normalizes_six_decimal_feed_to_identity() {
        // A feed already at 6 decimals must pass through unchanged.
        assert_eq!(normalize_pyth_price(1_234_567_890, -6).unwrap(), 1_234_567_890);
    }

    #[test]
    fn normalizes_zero_exponent() {
        // price = 42 exactly -> 42 * 1e6
        assert_eq!(normalize_pyth_price(42, 0).unwrap(), 42_000_000);
    }

    #[test]
    fn normalizes_positive_exponent() {
        // price = 5 * 10^2 = 500 -> 500 * 1e6
        assert_eq!(normalize_pyth_price(5, 2).unwrap(), 500_000_000);
    }

    #[test]
    fn rejects_absurd_exponent() {
        assert!(normalize_pyth_price(1, 40).is_err());
        assert!(normalize_pyth_price(1, -40).is_err());
    }

    #[test]
    fn rejects_overflowing_positive_exponent() {
        assert!(normalize_pyth_price(u64::MAX, 12).is_err());
    }

    // ── Slippage guards ─────────────────────────────────────────────────────

    #[test]
    fn entry_limit_rejects_long_above_limit() {
        assert!(enforce_entry_price_limit(&Side::Long, 101, 100).is_err());
        assert!(enforce_entry_price_limit(&Side::Long, 100, 100).is_ok());
        assert!(enforce_entry_price_limit(&Side::Long, 99, 100).is_ok());
    }

    #[test]
    fn entry_limit_rejects_short_below_limit() {
        assert!(enforce_entry_price_limit(&Side::Short, 99, 100).is_err());
        assert!(enforce_entry_price_limit(&Side::Short, 100, 100).is_ok());
        assert!(enforce_entry_price_limit(&Side::Short, 101, 100).is_ok());
    }

    #[test]
    fn exit_limit_rejects_long_below_limit() {
        assert!(enforce_exit_price_limit(&Side::Long, 99, 100).is_err());
        assert!(enforce_exit_price_limit(&Side::Long, 100, 100).is_ok());
    }

    #[test]
    fn exit_limit_rejects_short_above_limit() {
        assert!(enforce_exit_price_limit(&Side::Short, 101, 100).is_err());
        assert!(enforce_exit_price_limit(&Side::Short, 100, 100).is_ok());
    }

    #[test]
    fn zero_limit_disables_slippage_check() {
        assert!(enforce_entry_price_limit(&Side::Long, u64::MAX, 0).is_ok());
        assert!(enforce_exit_price_limit(&Side::Short, u64::MAX, 0).is_ok());
    }

    // ── Position math ───────────────────────────────────────────────────────

    #[test]
    fn size_is_notional_scaled_by_price() {
        // $1000 notional at $50.00 -> 20 units
        assert_eq!(calc_size(1_000_000_000, 50_000_000).unwrap(), 20_000_000);
    }

    #[test]
    fn calc_size_rejects_zero_price() {
        assert!(calc_size(1_000, 0).is_err());
    }

    #[test]
    fn long_liquidation_price_sits_below_entry() {
        // 10x long at $100: margin fraction 10%, maintenance 5%
        // -> 100 * (10000 - 1000 + 500)/10000 = $95
        let liq = calc_liquidation_price(100_000_000, 10, &Side::Long).unwrap();
        assert_eq!(liq, 95_000_000);
        assert!(liq < 100_000_000);
    }

    #[test]
    fn short_liquidation_price_sits_above_entry() {
        let liq = calc_liquidation_price(100_000_000, 10, &Side::Short).unwrap();
        assert_eq!(liq, 105_000_000);
        assert!(liq > 100_000_000);
    }

    #[test]
    fn pnl_is_signed_by_side() {
        // long 20 units from $50 -> $55 = +$100
        let long = calc_pnl(&Side::Long, 50_000_000, 55_000_000, 20_000_000).unwrap();
        assert_eq!(long, 100_000_000);
        // same move shorted = -$100
        let short = calc_pnl(&Side::Short, 50_000_000, 55_000_000, 20_000_000).unwrap();
        assert_eq!(short, -100_000_000);
    }

    #[test]
    fn weighted_average_blends_entries() {
        // 10 units @ $100 + 10 units @ $200 -> $150
        let blended =
            weighted_average_price(10_000_000, 100_000_000, 10_000_000, 200_000_000).unwrap();
        assert_eq!(blended, 150_000_000);
    }

    #[test]
    fn effective_leverage_rounds_up_and_is_bounded() {
        // 700 notional on 200 collateral -> ceil(3.5) = 4
        assert_eq!(calc_effective_leverage(200, 700).unwrap(), 4);
        // beyond 10x must be rejected outright
        assert!(calc_effective_leverage(100, 1_100).is_err());
        assert!(calc_effective_leverage(0, 100).is_err());
    }

    #[test]
    fn funding_rate_clamp_bounds_magnitude() {
        assert_eq!(clamp_funding_rate(10_000), MAX_FUNDING_RATE_BPS);
        assert_eq!(clamp_funding_rate(-10_000), -MAX_FUNDING_RATE_BPS);
        assert_eq!(clamp_funding_rate(7), 7);
    }

    // ── Spot math ───────────────────────────────────────────────────────────

    #[test]
    fn spot_quote_amount_is_price_times_size() {
        // 2 base @ $50.00 = $100.00
        assert_eq!(
            spot_quote_amount(50_000_000, 2_000_000).unwrap(),
            100_000_000
        );
    }

    #[test]
    fn spot_quote_amount_rounds_up_to_protect_the_vault() {
        // A cost of 1.5 base units must round to 2, never 1: rounding down
        // would let a buyer reserve less than the fill actually costs and the
        // remainder would come out of pooled funds.
        // price = 1.5 (1_500_000), size = 1 unit (1) -> 1.5 -> 2
        assert_eq!(spot_quote_amount(1_500_000, 1).unwrap(), 2);
    }

    #[test]
    fn spot_quote_amount_rejects_zero_inputs() {
        assert!(spot_quote_amount(0, 1_000).is_err());
        assert!(spot_quote_amount(1_000, 0).is_err());
    }

    #[test]
    fn spot_quote_amount_rejects_overflow() {
        assert!(spot_quote_amount(u64::MAX, u64::MAX).is_err());
    }

    #[test]
    fn spot_fee_rounds_down_and_never_exceeds_notional() {
        // 30 bps on $100 = $0.30
        assert_eq!(spot_fee(100_000_000, 30).unwrap(), 300_000);
        // Tiny notional rounds down to zero rather than over-charging.
        assert_eq!(spot_fee(1, 30).unwrap(), 0);
        // A zero fee rate is a valid no-op.
        assert_eq!(spot_fee(100_000_000, 0).unwrap(), 0);
    }

    #[test]
    fn spot_fee_leaves_positive_proceeds_for_seller() {
        let quote = 100_000_000_u64;
        let fee = spot_fee(quote, 100).unwrap(); // 1%
        assert!(fee < quote);
        assert_eq!(quote - fee, 99_000_000);
    }

    #[test]
    fn buyer_refund_is_non_negative_when_filled_below_limit() {
        // Buyer bid $51, fill at $50 for 2 base: reserved 102, cost 100.
        let reserved = spot_quote_amount(51_000_000, 2_000_000).unwrap();
        let cost = spot_quote_amount(50_000_000, 2_000_000).unwrap();
        assert!(reserved >= cost);
        assert_eq!(reserved - cost, 2_000_000);
    }
}
