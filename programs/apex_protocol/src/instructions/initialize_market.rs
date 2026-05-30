use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::{Market, OrderBook};

#[derive(Accounts)]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Market::LEN,
        seeds = [b"market", base_mint.key().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = authority,
        token::mint = base_mint,
        token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    pub base_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + OrderBook::LEN,
        seeds = [b"orderbook", market.key().as_ref()],
        bump
    )]
    pub order_book: Account<'info, OrderBook>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeMarket>, fee_rate: u64, oracle: Pubkey) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.authority = ctx.accounts.authority.key();
    market.oracle = oracle;
    market.vault = ctx.accounts.vault.key();
    market.base_mint = ctx.accounts.base_mint.key();
    market.insurance_fund = 0;
    market.open_interest_long = 0;
    market.open_interest_short = 0;
    market.funding_rate = 0;
    market.last_funding_ts = Clock::get()?.unix_timestamp;
    market.fee_rate = fee_rate;
    market.bump = ctx.bumps.market;

    let order_book = &mut ctx.accounts.order_book;
    order_book.market = market.key();
    order_book.asks = Vec::new();
    order_book.bids = Vec::new();
    order_book.bump = ctx.bumps.order_book;

    Ok(())
}
