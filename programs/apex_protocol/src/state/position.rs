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
    /// Exact quote-denominated notional this position contributed to open
    /// interest. Stored explicitly rather than recomputed from
    /// `collateral * leverage`, because `leverage` is a rounded (ceiling)
    /// value after position blending — recomputing it caused open interest to
    /// drift on close and silently saturate to zero.
    pub notional: u64,
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
    // 32 + 32 + 1 + (8 * 8) + 1 + 1 = 131 bytes of payload, 139 on-chain.
    pub const LEN: usize = 32 * 2 + 1 + 8 * 8 + 1 + 1;
}
