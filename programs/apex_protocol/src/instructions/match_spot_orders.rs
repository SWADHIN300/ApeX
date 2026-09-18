use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct MatchSpotOrders<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(
        mut,
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
    /// CHECK: must match the owner of the best bid.
    pub buyer: AccountInfo<'info>,
    /// CHECK: must match the owner of the best ask.
    pub seller: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"spot_balance", spot_market.key().as_ref(), buyer.key().as_ref()],
        bump = buyer_balance.bump,
    )]
    pub buyer_balance: Account<'info, SpotBalance>,
    #[account(
        mut,
        seeds = [b"spot_balance", spot_market.key().as_ref(), seller.key().as_ref()],
        bump = seller_balance.bump,
    )]
    pub seller_balance: Account<'info, SpotBalance>,
    /// CHECK: only used to satisfy `has_one = market` on the order book.
    #[account(address = spot_market.key())]
    pub market: AccountInfo<'info>,
}

pub fn handler(ctx: Context<MatchSpotOrders>) -> Result<()> {
    let bid = ctx
        .accounts
        .order_book
        .bids
        .first()
        .cloned()
        .ok_or(ApexError::InvalidOrderIndex)?;
    let ask = ctx
        .accounts
        .order_book
        .asks
        .first()
        .cloned()
        .ok_or(ApexError::InvalidOrderIndex)?;

    require!(ask.price <= bid.price, ApexError::OrderNotOpen);
    require!(bid.status == OrderStatus::Open, ApexError::OrderNotOpen);
    require!(ask.status == OrderStatus::Open, ApexError::OrderNotOpen);
    require!(bid.side == Side::Long, ApexError::InvalidSpotOrder);
    require!(ask.side == Side::Short, ApexError::InvalidSpotOrder);
    require_keys_eq!(bid.owner, ctx.accounts.buyer.key(), ApexError::OrderOwnerMismatch);
    require_keys_eq!(ask.owner, ctx.accounts.seller.key(), ApexError::OrderOwnerMismatch);
    // Self-trading would let one account wash-trade to move the printed price
    // at no risk, and would also alias two &mut borrows of the same balance.
    require!(bid.owner != ask.owner, ApexError::SelfTradeNotAllowed);

    let fill_size = ask.size.min(bid.size);
    require!(fill_size > 0, ApexError::InvalidSpotOrder);

    // Price improvement is split evenly, matching the perp book's convention.
    let fill_price = u64::try_from(
        (ask.price as u128)
            .checked_add(bid.price as u128)
            .ok_or(ApexError::MathOverflow)?
            .checked_div(2)
            .ok_or(ApexError::MathOverflow)?,
    )
    .map_err(|_| ApexError::MathOverflow)?;
    require!(fill_price > 0, ApexError::MathOverflow);

    // What the buyer actually owes, and what they had reserved at their own
    // (higher or equal) limit price. The difference is theirs to keep.
    let quote_cost = spot_quote_amount(fill_price, fill_size)?;
    let quote_reserved = if fill_size >= bid.size {
        bid.locked_collateral
    } else {
        spot_quote_amount(bid.price, fill_size)?.min(bid.locked_collateral)
    };
    require!(quote_reserved >= quote_cost, ApexError::MathOverflow);
    let refund = quote_reserved
        .checked_sub(quote_cost)
        .ok_or(ApexError::MathOverflow)?;

    let fee = spot_fee(quote_cost, ctx.accounts.spot_market.fee_rate)?;
    let seller_proceeds = quote_cost.checked_sub(fee).ok_or(ApexError::MathOverflow)?;

    // ── Buyer: release reserved quote, receive base, reclaim overpayment ────
    {
        let buyer_balance = &mut ctx.accounts.buyer_balance;
        require_keys_eq!(
            buyer_balance.owner,
            ctx.accounts.buyer.key(),
            ApexError::Unauthorized
        );
        require!(
            buyer_balance.quote_locked >= quote_reserved,
            ApexError::InsufficientSpotBalance
        );
        buyer_balance.quote_locked = buyer_balance
            .quote_locked
            .checked_sub(quote_reserved)
            .ok_or(ApexError::MathOverflow)?;
        buyer_balance.base_free = buyer_balance
            .base_free
            .checked_add(fill_size)
            .ok_or(ApexError::MathOverflow)?;
        if refund > 0 {
            buyer_balance.quote_free = buyer_balance
                .quote_free
                .checked_add(refund)
                .ok_or(ApexError::MathOverflow)?;
        }
    }

    // ── Seller: deliver base, receive quote net of fee ──────────────────────
    {
        let seller_balance = &mut ctx.accounts.seller_balance;
        require_keys_eq!(
            seller_balance.owner,
            ctx.accounts.seller.key(),
            ApexError::Unauthorized
        );
        require!(
            seller_balance.base_locked >= fill_size,
            ApexError::InsufficientSpotBalance
        );
        seller_balance.base_locked = seller_balance
            .base_locked
            .checked_sub(fill_size)
            .ok_or(ApexError::MathOverflow)?;
        seller_balance.quote_free = seller_balance
            .quote_free
            .checked_add(seller_proceeds)
            .ok_or(ApexError::MathOverflow)?;
    }

    // Fees stay in the quote vault, tracked so they can be swept later.
    ctx.accounts.spot_market.fees_accrued = ctx
        .accounts
        .spot_market
        .fees_accrued
        .checked_add(fee)
        .ok_or(ApexError::MathOverflow)?;

    consume_best_spot_order(&mut ctx.accounts.order_book.bids, fill_size, quote_reserved)?;
    consume_best_spot_order(&mut ctx.accounts.order_book.asks, fill_size, fill_size)?;

    emit!(SpotFilled {
        market: ctx.accounts.spot_market.key(),
        buyer: bid.owner,
        seller: ask.owner,
        price: fill_price,
        size: fill_size,
        quote_amount: quote_cost,
        fee,
    });

    Ok(())
}

/// Removes the top-of-book order, or reduces it in place when only partially
/// filled. Reducing the front entry preserves the price ordering, so no re-sort
/// is needed.
fn consume_best_spot_order(
    orders: &mut Vec<Order>,
    fill_size: u64,
    reserved_consumed: u64,
) -> Result<()> {
    require!(!orders.is_empty(), ApexError::InvalidOrderIndex);

    if fill_size >= orders[0].size {
        orders.remove(0);
        return Ok(());
    }

    orders[0].size = orders[0]
        .size
        .checked_sub(fill_size)
        .ok_or(ApexError::MathOverflow)?;
    orders[0].locked_collateral = orders[0]
        .locked_collateral
        .saturating_sub(reserved_consumed);

    Ok(())
}
