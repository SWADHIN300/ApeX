use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct PlaceSpotOrder<'info> {
    pub trader: Signer<'info>,
    #[account(
        seeds = [b"spot_market", spot_market.base_mint.as_ref(), spot_market.quote_mint.as_ref()],
        bump = spot_market.bump,
    )]
    pub spot_market: Account<'info, SpotMarket>,
    #[account(
        mut,
        has_one = market,
        seeds = [b"spot_orderbook", spot_market.key().as_ref()],
        bump = order_book.bump,
    )]
    pub order_book: Account<'info, OrderBook>,
    #[account(
        mut,
        seeds = [b"spot_balance", spot_market.key().as_ref(), trader.key().as_ref()],
        bump = balance.bump,
        constraint = balance.owner == trader.key() @ ApexError::Unauthorized,
        constraint = balance.market == spot_market.key() @ ApexError::Unauthorized,
    )]
    pub balance: Account<'info, SpotBalance>,
    /// CHECK: only used to satisfy `has_one = market` on the order book.
    #[account(address = spot_market.key())]
    pub market: AccountInfo<'info>,
}

pub fn handler(ctx: Context<PlaceSpotOrder>, side: Side, price: u64, size: u64) -> Result<()> {
    require!(price > 0 && size > 0, ApexError::InvalidSpotOrder);

    let order_book = &mut ctx.accounts.order_book;
    require!(
        order_book.asks.len() + order_book.bids.len() < MAX_ORDERS,
        ApexError::OrderBookFull
    );

    let balance = &mut ctx.accounts.balance;

    // Buys reserve quote (what they will pay); sells reserve base (what they
    // will deliver). Reserving up front is what makes fills unfailable later.
    let locked = match side {
        Side::Long => {
            let quote_needed = spot_quote_amount(price, size)?;
            require!(
                balance.quote_free >= quote_needed,
                ApexError::InsufficientSpotBalance
            );
            balance.quote_free = balance
                .quote_free
                .checked_sub(quote_needed)
                .ok_or(ApexError::MathOverflow)?;
            balance.quote_locked = balance
                .quote_locked
                .checked_add(quote_needed)
                .ok_or(ApexError::MathOverflow)?;
            quote_needed
        }
        Side::Short => {
            require!(balance.base_free >= size, ApexError::InsufficientSpotBalance);
            balance.base_free = balance
                .base_free
                .checked_sub(size)
                .ok_or(ApexError::MathOverflow)?;
            balance.base_locked = balance
                .base_locked
                .checked_add(size)
                .ok_or(ApexError::MathOverflow)?;
            size
        }
    };

    let order = Order {
        owner: ctx.accounts.trader.key(),
        side: side.clone(),
        price,
        size,
        // Reuses the perp `Order` layout: for spot this is the reserved token
        // amount (quote for buys, base for sells) rather than margin.
        locked_collateral: locked,
        // Spot is unleveraged; kept at 1 so the shared struct stays valid.
        leverage: 1,
        status: OrderStatus::Open,
        created_at: Clock::get()?.unix_timestamp,
    };

    // Keep both sides price-sorted via binary-search insert, matching the perp
    // book: bids descending, asks ascending, ties behind existing orders.
    match side {
        Side::Long => {
            let index = order_book
                .bids
                .partition_point(|existing| existing.price >= price);
            order_book.bids.insert(index, order);
        }
        Side::Short => {
            let index = order_book
                .asks
                .partition_point(|existing| existing.price <= price);
            order_book.asks.insert(index, order);
        }
    }

    Ok(())
}
