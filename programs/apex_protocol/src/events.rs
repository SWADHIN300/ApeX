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
