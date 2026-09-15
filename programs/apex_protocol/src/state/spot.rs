use anchor_lang::prelude::*;

/// An order-book spot market for a `base_mint` / `quote_mint` pair.
///
/// Keyed by the token pair itself (`[b"spot_market", base_mint, quote_mint]`),
/// which is naturally unique — unlike the perp `Market`, this needs no extra
/// discriminating seed.
///
/// Spot trading settles by moving real tokens between the two counterparties'
/// internal balances, so there is no leverage, funding, or liquidation path.
#[account]
pub struct SpotMarket {
    pub authority: Pubkey,
    pub base_mint: Pubkey,
    pub quote_mint: Pubkey,
    /// Pooled custody of every trader's base tokens.
    pub base_vault: Pubkey,
    /// Pooled custody of every trader's quote tokens.
    pub quote_vault: Pubkey,
    /// Taker fee in basis points, charged in quote on each fill.
    pub fee_rate: u64,
    /// Quote-denominated fees collected and still held in `quote_vault`.
    pub fees_accrued: u64,
    pub bump: u8,
}

impl SpotMarket {
    // (32 * 5) + 8 + 8 + 1 = 177
    pub const LEN: usize = 32 * 5 + 8 + 8 + 1;
}

/// A trader's balances inside a single spot market.
///
/// `free` may be withdrawn or committed to new orders; `locked` is reserved by
/// resting orders and is released on fill or cancel. Deposits and fills only
/// ever move numbers between these fields — tokens themselves stay pooled in
/// the market's vaults until withdrawal.
#[account]
pub struct SpotBalance {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub base_free: u64,
    pub base_locked: u64,
    pub quote_free: u64,
    pub quote_locked: u64,
    pub bump: u8,
}

impl SpotBalance {
    // 32 + 32 + (8 * 4) + 1 = 97
    pub const LEN: usize = 32 + 32 + 8 * 4 + 1;
}
