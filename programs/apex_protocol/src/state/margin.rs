use anchor_lang::prelude::*;

#[account]
pub struct TraderMarginAccount {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub deposited_collateral: u64,
    pub locked_collateral: u64,
    pub bump: u8,
}

impl TraderMarginAccount {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}

#[account]
pub struct PendingPayout {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub amount: u64,
    pub created_at: i64,
    pub bump: u8,
}

impl PendingPayout {
    pub const LEN: usize = 32 + 32 + 8 + 8 + 1;
}
