use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::*;

#[derive(Accounts)]
pub struct InitializeSpotMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// Keyed by the token pair, which is unique on its own.
    #[account(
        init,
        payer = authority,
        space = 8 + SpotMarket::LEN,
        seeds = [b"spot_market", base_mint.key().as_ref(), quote_mint.key().as_ref()],
        bump
    )]
    pub spot_market: Account<'info, SpotMarket>,
    pub base_mint: Account<'info, Mint>,
    pub quote_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        token::mint = base_mint,
        token::authority = spot_market
    )]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = authority,
        token::mint = quote_mint,
        token::authority = spot_market
    )]
    pub quote_vault: Account<'info, TokenAccount>,
    /// Each spot market gets its own book, distinct from the perp book.
    #[account(
        init,
        payer = authority,
        space = 8 + OrderBook::LEN,
        seeds = [b"spot_orderbook", spot_market.key().as_ref()],
        bump
    )]
    pub order_book: Account<'info, OrderBook>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeSpotMarket>, fee_rate: u64) -> Result<()> {
    // Same bound as perp markets: 1 to 100 bps.
    require!(fee_rate > 0 && fee_rate <= 100, ApexError::InvalidFeeRate);
    require!(
        ctx.accounts.base_mint.key() != ctx.accounts.quote_mint.key(),
        ApexError::InvalidSpotPair
    );

    let market = &mut ctx.accounts.spot_market;
    market.authority = ctx.accounts.authority.key();
    market.base_mint = ctx.accounts.base_mint.key();
    market.quote_mint = ctx.accounts.quote_mint.key();
    market.base_vault = ctx.accounts.base_vault.key();
    market.quote_vault = ctx.accounts.quote_vault.key();
    market.fee_rate = fee_rate;
    market.fees_accrued = 0;
    market.bump = ctx.bumps.spot_market;

    let order_book = &mut ctx.accounts.order_book;
    order_book.market = market.key();
    order_book.asks = Vec::new();
    order_book.bids = Vec::new();
    order_book.bump = ctx.bumps.order_book;

    Ok(())
}

/// Seeds that let the spot market sign as vault authority.
pub fn spot_market_signer_seeds<'a>(
    base_mint: &'a Pubkey,
    quote_mint: &'a Pubkey,
    bump: &'a u8,
) -> [&'a [u8]; 4] {
    [
        b"spot_market",
        base_mint.as_ref(),
        quote_mint.as_ref(),
        std::slice::from_ref(bump),
    ]
}
