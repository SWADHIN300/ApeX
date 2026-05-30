use anchor_lang::prelude::*;
use anchor_spl::token::Token;

use crate::*;

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    pub keeper: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    #[account(mut, has_one = market)]
    pub order_book: Account<'info, OrderBook>,
    /// CHECK: protocol vault; retained for future settlement hooks.
    pub vault: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<MatchOrders>) -> Result<()> {
    let order_book = &mut ctx.accounts.order_book;
    let market = &mut ctx.accounts.market;

    while let (Some(ask), Some(bid)) = (
        order_book.asks.first().cloned(),
        order_book.bids.first().cloned(),
    ) {
        if ask.price > bid.price {
            break;
        }

        let fill_size = ask.size.min(bid.size);
        let fill_price = ask
            .price
            .checked_add(bid.price)
            .ok_or(ApexError::MathOverflow)?
            .checked_div(2)
            .ok_or(ApexError::MathOverflow)?;

        market.open_interest_short = market
            .open_interest_short
            .checked_add(fill_size)
            .ok_or(ApexError::MathOverflow)?;
        market.open_interest_long = market
            .open_interest_long
            .checked_add(fill_size)
            .ok_or(ApexError::MathOverflow)?;

        emit!(OrderFilled {
            maker: ask.owner,
            taker: bid.owner,
            fill_price,
            size: fill_size,
        });

        order_book.asks.remove(0);
        order_book.bids.remove(0);
    }

    Ok(())
}
