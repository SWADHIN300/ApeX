use anchor_lang::prelude::*;

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub oracle: Pubkey,
    pub vault: Pubkey,
    pub base_mint: Pubkey,
    pub insurance_fund: u64,
    pub liquidity_pool: u64,
    pub pending_payouts_total: u64,
    pub open_interest_long: u64,
    pub open_interest_short: u64,
    pub funding_rate: i64,
    pub last_funding_ts: i64,
    pub fee_rate: u64,
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 32 * 4 + 8 * 8 + 1;
}
