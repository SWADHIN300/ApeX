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

declare_id!("E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s");

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

    pub fn open_position(
        ctx: Context<OpenPosition>,
        side: Side,
        collateral: u64,
        leverage: u8,
    ) -> Result<()> {
        instructions::open_position::handler(ctx, side, collateral, leverage)
    }

    pub fn close_position(ctx: Context<ClosePosition>) -> Result<()> {
        instructions::close_position::handler(ctx)
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

    pub fn liquidate(ctx: Context<Liquidate>) -> Result<()> {
        instructions::liquidate::handler(ctx)
    }

    pub fn update_funding_rate(ctx: Context<UpdateFundingRate>) -> Result<()> {
        instructions::update_funding_rate::handler(ctx)
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
    let max_conf = price_abs
        .checked_mul(MAX_CONFIDENCE_BPS)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(FEE_DENOMINATOR)
        .ok_or(ApexError::MathOverflow)?;
    require!(confidence <= max_conf, ApexError::OraclePriceStale);

    normalize_pyth_price(price_abs, price_account.exponent)
}

fn normalize_pyth_price(raw_price: u64, exponent: i32) -> Result<u64> {
    if exponent >= 0 {
        let scale = 10_u64
            .checked_pow(exponent as u32)
            .ok_or(ApexError::MathOverflow)?;
        raw_price
            .checked_mul(scale)
            .and_then(|price| price.checked_mul(PRICE_DECIMALS))
            .ok_or(ApexError::MathOverflow.into())
    } else {
        let scale = 10_u64
            .checked_pow(exponent.unsigned_abs())
            .ok_or(ApexError::MathOverflow)?;
        raw_price
            .checked_mul(PRICE_DECIMALS)
            .and_then(|price| price.checked_div(scale))
            .ok_or(ApexError::MathOverflow.into())
    }
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

pub fn calc_notional(collateral: u64, leverage: u8) -> Result<u64> {
    collateral
        .checked_mul(leverage as u64)
        .ok_or(ApexError::MathOverflow.into())
}

pub fn calc_size(notional: u64, entry_price: u64) -> Result<u64> {
    notional
        .checked_mul(PRICE_DECIMALS)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(entry_price)
        .ok_or(ApexError::MathOverflow.into())
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
    entry_price
        .checked_mul(numerator)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(FEE_DENOMINATOR)
        .ok_or(ApexError::MathOverflow.into())
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

pub fn market_signer_seeds<'a>(base_mint: &'a Pubkey, bump: &'a u8) -> [&'a [u8]; 3] {
    [b"market", base_mint.as_ref(), std::slice::from_ref(bump)]
}
