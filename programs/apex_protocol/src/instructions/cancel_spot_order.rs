use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct CancelSpotOrder<'info> {
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

pub fn handler(ctx: Context<CancelSpotOrder>, order_index: u64, side: Side) -> Result<()> {
    let orders = match side {
        Side::Long => &mut ctx.accounts.order_book.bids,
        Side::Short => &mut ctx.accounts.order_book.asks,
    };

    let index = usize::try_from(order_index).map_err(|_| ApexError::InvalidOrderIndex)?;
    require!(index < orders.len(), ApexError::InvalidOrderIndex);

    let order = &orders[index];
    require_keys_eq!(order.owner, ctx.accounts.trader.key(), ApexError::Unauthorized);
    require!(order.status == OrderStatus::Open, ApexError::OrderNotOpen);
    require!(order.side == side, ApexError::InvalidSpotOrder);

    let reserved = order.locked_collateral;
    let balance = &mut ctx.accounts.balance;

    // Release exactly what this order reserved back to the free balance.
    match side {
        Side::Long => {
            require!(
                balance.quote_locked >= reserved,
                ApexError::InsufficientSpotBalance
            );
            balance.quote_locked = balance
                .quote_locked
                .checked_sub(reserved)
                .ok_or(ApexError::MathOverflow)?;
            balance.quote_free = balance
                .quote_free
                .checked_add(reserved)
                .ok_or(ApexError::MathOverflow)?;
        }
        Side::Short => {
            require!(
                balance.base_locked >= reserved,
                ApexError::InsufficientSpotBalance
            );
            balance.base_locked = balance
                .base_locked
                .checked_sub(reserved)
                .ok_or(ApexError::MathOverflow)?;
            balance.base_free = balance
                .base_free
                .checked_add(reserved)
                .ok_or(ApexError::MathOverflow)?;
        }
    }

    // `remove` preserves the price ordering of the remaining entries.
    let orders = match side {
        Side::Long => &mut ctx.accounts.order_book.bids,
        Side::Short => &mut ctx.accounts.order_book.asks,
    };
    orders.remove(index);

    Ok(())
}
