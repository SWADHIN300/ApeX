use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub market: Account<'info, Market>,
    #[account(mut, has_one = market)]
    pub order_book: Account<'info, OrderBook>,
    /// CHECK: kept for client compatibility; no funds are moved by limit order placement.
    pub trader_token_account: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PlaceOrder>,
    side: Side,
    price: u64,
    size: u64,
    leverage: u8,
) -> Result<()> {
    validate_leverage(leverage)?;
    require!(price > 0 && size > 0, ApexError::InsufficientCollateral);

    let order_book = &mut ctx.accounts.order_book;
    require!(
        order_book.asks.len() + order_book.bids.len() < MAX_ORDERS,
        ApexError::OrderBookFull
    );

    let order = Order {
        owner: ctx.accounts.signer.key(),
        side: side.clone(),
        price,
        size,
        leverage,
        status: OrderStatus::Open,
        created_at: Clock::get()?.unix_timestamp,
    };

    match side {
        Side::Long => {
            order_book.bids.push(order);
            order_book.bids.sort_by(|a, b| b.price.cmp(&a.price));
        }
        Side::Short => {
            order_book.asks.push(order);
            order_book.asks.sort_by(|a, b| a.price.cmp(&b.price));
        }
    }

    Ok(())
}
