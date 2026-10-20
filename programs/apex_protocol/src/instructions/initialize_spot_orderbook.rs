use anchor_lang::prelude::*;

use crate::{OrderBook, SpotMarket};

#[derive(Accounts)]
pub struct InitializeSpotOrderbook<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        has_one = authority,
        seeds = [b"spot_market", spot_market.base_mint.as_ref(), spot_market.quote_mint.as_ref()],
        bump = spot_market.bump
    )]
    pub spot_market: Account<'info, SpotMarket>,
    #[account(
        init,
        payer = authority,
        space = 8 + OrderBook::LEN,
        seeds = [b"spot_orderbook", spot_market.key().as_ref()],
        bump
    )]
    pub order_book: Account<'info, OrderBook>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeSpotOrderbook>) -> Result<()> {
    let order_book = &mut ctx.accounts.order_book;
    order_book.market = ctx.accounts.spot_market.key();
    order_book.asks = Vec::new();
    order_book.bids = Vec::new();
    order_book.bump = ctx.bumps.order_book;
    Ok(())
}
