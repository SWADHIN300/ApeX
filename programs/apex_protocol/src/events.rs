use anchor_lang::prelude::*;

use crate::state::Side;

#[event]
pub struct PositionOpened {
    pub owner: Pubkey,
    pub side: Side,
    pub entry_price: u64,
    pub size: u64,
    pub leverage: u8,
    pub liquidation_price: u64,
}

#[event]
pub struct PositionClosed {
    pub owner: Pubkey,
    pub realized_pnl: i64,
    pub exit_price: u64,
}

#[event]
pub struct PositionLiquidated {
    pub owner: Pubkey,
    pub keeper: Pubkey,
    pub mark_price: u64,
    pub collateral_seized: u64,
    /// Equity returned to the trader's margin account after the keeper fee.
    pub residual_returned: u64,
    /// Shortfall the insurance fund had to absorb because the position was
    /// underwater beyond its posted collateral.
    pub bad_debt: u64,
}

#[event]
pub struct OrderFilled {
    pub maker: Pubkey,
    pub taker: Pubkey,
    pub fill_price: u64,
    pub size: u64,
}

#[event]
pub struct FundingUpdated {
    pub funding_rate: i64,
    pub timestamp: i64,
}

#[event]
pub struct PendingPayoutClaimed {
    pub owner: Pubkey,
    pub amount: u64,
    pub remaining: u64,
}
