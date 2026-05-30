use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum Side {
    Long,
    Short,
}

#[account]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub side: Side,
    pub collateral: u64,
    pub size: u64,
    pub entry_price: u64,
    pub leverage: u8,
    pub liquidation_price: u64,
    pub unrealized_pnl: i64,
    pub funding_settled: i64,
    pub created_at: i64,
    pub bump: u8,
}

impl Position {
    pub const LEN: usize = 32 * 2 + 1 + 8 * 7 + 1 + 1;
}
