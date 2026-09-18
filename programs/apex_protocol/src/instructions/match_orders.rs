use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

use crate::*;

#[derive(Accounts)]
pub struct MatchOrders<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(mut, has_one = vault, has_one = oracle)]
    pub market: Account<'info, Market>,
    #[account(mut, has_one = market)]
    pub order_book: Account<'info, OrderBook>,
    /// CHECK: Must match the owner of the best bid in the order book.
    pub bid_owner: AccountInfo<'info>,
    /// CHECK: Must match the owner of the best ask in the order book.
    pub ask_owner: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [b"margin", market.key().as_ref(), bid_owner.key().as_ref()],
        bump = bid_margin.bump
    )]
    pub bid_margin: Account<'info, TraderMarginAccount>,
    #[account(
        mut,
        seeds = [b"margin", market.key().as_ref(), ask_owner.key().as_ref()],
        bump = ask_margin.bump
    )]
    pub ask_margin: Account<'info, TraderMarginAccount>,
    #[account(
        init_if_needed,
        payer = keeper,
        space = 8 + Position::LEN,
        seeds = [b"position", market.key().as_ref(), bid_owner.key().as_ref()],
        bump
    )]
    pub bid_position: Account<'info, Position>,
    #[account(
        init_if_needed,
        payer = keeper,
        space = 8 + Position::LEN,
        seeds = [b"position", market.key().as_ref(), ask_owner.key().as_ref()],
        bump
    )]
    pub ask_position: Account<'info, Position>,
    #[account(mut, constraint = vault.mint == market.base_mint @ ApexError::Unauthorized)]
    pub vault: Account<'info, TokenAccount>,
    /// CHECK: validated by Pyth parser. When it carries valid, fresh Pyth data
    /// the execution price is bounded to the oracle mark. If the price is stale
    /// or the account missing, matching still proceeds (defense-in-depth, not a
    /// hard dependency).
    pub oracle: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<MatchOrders>) -> Result<()> {
    let order_book = &mut ctx.accounts.order_book;
    let market = &mut ctx.accounts.market;

    let ask = order_book
        .asks
        .first()
        .cloned()
        .ok_or(ApexError::InvalidOrderIndex)?;
    let bid = order_book
        .bids
        .first()
        .cloned()
        .ok_or(ApexError::InvalidOrderIndex)?;

    require!(ask.price <= bid.price, ApexError::OrderNotOpen);
    require!(
        ask.owner == ctx.accounts.ask_owner.key(),
        ApexError::OrderOwnerMismatch
    );
    require!(
        bid.owner == ctx.accounts.bid_owner.key(),
        ApexError::OrderOwnerMismatch
    );
    // Self-trade prevention: matching a trader against themselves would open
    // offsetting long/short positions on one account and let them move the
    // book's last price at zero net risk.
    require!(bid.owner != ask.owner, ApexError::SelfTradeNotAllowed);
    require!(ask.status == OrderStatus::Open, ApexError::OrderNotOpen);
    require!(bid.status == OrderStatus::Open, ApexError::OrderNotOpen);
    require!(ask.side == Side::Short, ApexError::OrderOwnerMismatch);
    require!(bid.side == Side::Long, ApexError::OrderOwnerMismatch);

    let fill_size = ask.size.min(bid.size);
    require!(fill_size > 0, ApexError::InsufficientCollateral);

    let fill_price = (ask.price as u128)
        .checked_add(bid.price as u128)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(2)
        .ok_or(ApexError::MathOverflow)?;
    let fill_price = u64::try_from(fill_price).map_err(|_| ApexError::MathOverflow)?;
    require!(fill_price > 0, ApexError::MathOverflow);

    // Defense-in-depth: if the supplied oracle carries valid, fresh Pyth data,
    // bound the execution price to it. This stops two colluding accounts from
    // crossing at an arbitrary mid that manufactures a favoured entry. A stale
    // or missing oracle is tolerated (matching is not blocked) — the guard is
    // only active when the price is trustworthy.
    if let Ok(mark) = get_oracle_price(&ctx.accounts.oracle, &Clock::get()?) {
        let band = (mark as u128)
            .checked_mul(MAX_MATCH_PRICE_DEVIATION_BPS as u128)
            .and_then(|v| v.checked_div(FEE_DENOMINATOR as u128))
            .ok_or(ApexError::MathOverflow)?
            as u64;
        let hi = mark
            .checked_add(band)
            .ok_or(ApexError::MathOverflow)?;
        let lo = mark.saturating_sub(band);
        require!(
            fill_price >= lo && fill_price <= hi,
            ApexError::SlippageExceeded
        );
    }

    let bid_collateral_used = proportional_collateral(bid.locked_collateral, fill_size, bid.size)?;
    let ask_collateral_used = proportional_collateral(ask.locked_collateral, fill_size, ask.size)?;
    require!(
        ctx.accounts.bid_margin.locked_collateral >= bid_collateral_used,
        ApexError::InsufficientLockedCollateral
    );
    require!(
        ctx.accounts.ask_margin.locked_collateral >= ask_collateral_used,
        ApexError::InsufficientLockedCollateral
    );

    ctx.accounts.bid_margin.locked_collateral = ctx
        .accounts
        .bid_margin
        .locked_collateral
        .checked_sub(bid_collateral_used)
        .ok_or(ApexError::MathOverflow)?;
    ctx.accounts.ask_margin.locked_collateral = ctx
        .accounts
        .ask_margin
        .locked_collateral
        .checked_sub(ask_collateral_used)
        .ok_or(ApexError::MathOverflow)?;

    let bid_notional = calc_notional(bid_collateral_used, bid.leverage)?;
    let ask_notional = calc_notional(ask_collateral_used, ask.leverage)?;

    let now = Clock::get()?.unix_timestamp;
    apply_fill_to_position(
        &mut ctx.accounts.bid_position,
        ctx.accounts.bid_owner.key(),
        market.key(),
        Side::Long,
        bid_collateral_used,
        bid_notional,
        fill_price,
        bid.leverage,
        ctx.bumps.bid_position,
        now,
    )?;
    apply_fill_to_position(
        &mut ctx.accounts.ask_position,
        ctx.accounts.ask_owner.key(),
        market.key(),
        Side::Short,
        ask_collateral_used,
        ask_notional,
        fill_price,
        ask.leverage,
        ctx.bumps.ask_position,
        now,
    )?;

    market.open_interest_long = market
        .open_interest_long
        .checked_add(bid_notional)
        .ok_or(ApexError::MathOverflow)?;
    market.open_interest_short = market
        .open_interest_short
        .checked_add(ask_notional)
        .ok_or(ApexError::MathOverflow)?;

    consume_best_order(&mut order_book.bids, fill_size, bid_collateral_used)?;
    consume_best_order(&mut order_book.asks, fill_size, ask_collateral_used)?;

    emit!(OrderFilled {
        maker: ask.owner,
        taker: bid.owner,
        fill_price,
        size: fill_size,
    });

    Ok(())
}

fn proportional_collateral(locked_collateral: u64, fill_size: u64, order_size: u64) -> Result<u64> {
    require!(order_size > 0, ApexError::MathOverflow);
    let amount = (locked_collateral as u128)
        .checked_mul(fill_size as u128)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(order_size as u128)
        .ok_or(ApexError::MathOverflow)?;
    let amount = u64::try_from(amount).map_err(|_| ApexError::MathOverflow)?;
    Ok(amount.max(1).min(locked_collateral))
}

/// Removes or reduces the top-of-book order. The book is kept sorted by
/// construction, so reducing the front entry preserves the ordering invariant
/// and no re-sort is needed.
fn consume_best_order(orders: &mut Vec<Order>, fill_size: u64, collateral_used: u64) -> Result<()> {
    require!(!orders.is_empty(), ApexError::InvalidOrderIndex);
    if fill_size >= orders[0].size {
        orders.remove(0);
    } else {
        orders[0].size = orders[0]
            .size
            .checked_sub(fill_size)
            .ok_or(ApexError::MathOverflow)?;
        orders[0].locked_collateral = orders[0]
            .locked_collateral
            .checked_sub(collateral_used)
            .ok_or(ApexError::MathOverflow)?;
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn apply_fill_to_position<'info>(
    position: &mut Account<'info, Position>,
    owner: Pubkey,
    market: Pubkey,
    side: Side,
    collateral: u64,
    notional: u64,
    entry_price: u64,
    leverage: u8,
    bump: u8,
    now: i64,
) -> Result<()> {
    validate_leverage(leverage)?;
    require!(collateral > 0, ApexError::InsufficientCollateral);
    let added_size = calc_size(notional, entry_price)?;
    require!(added_size > 0, ApexError::InsufficientCollateral);
    let is_new_position = position.owner == Pubkey::default() || position.size == 0;

    if is_new_position {
        position.owner = owner;
        position.market = market;
        position.side = side.clone();
        position.collateral = collateral;
        position.notional = notional;
        position.size = added_size;
        position.entry_price = entry_price;
        position.leverage = leverage;
        position.liquidation_price = calc_liquidation_price(entry_price, leverage, &side)?;
        position.unrealized_pnl = 0;
        position.funding_settled = 0;
        position.created_at = now;
        position.bump = bump;
        return Ok(());
    }

    require!(position.owner == owner, ApexError::Unauthorized);
    require!(position.market == market, ApexError::Unauthorized);
    require!(position.side == side, ApexError::PositionSideMismatch);

    // Accumulate the exact filled notional rather than deriving it from the
    // rounded leverage, which is what caused open-interest drift on close.
    let total_notional = position
        .notional
        .checked_add(notional)
        .ok_or(ApexError::MathOverflow)?;
    let total_collateral = position
        .collateral
        .checked_add(collateral)
        .ok_or(ApexError::MathOverflow)?;
    let total_size = position
        .size
        .checked_add(added_size)
        .ok_or(ApexError::MathOverflow)?;
    let blended_entry =
        weighted_average_price(position.size, position.entry_price, added_size, entry_price)?;
    let effective_leverage = calc_effective_leverage(total_collateral, total_notional)?;

    position.collateral = total_collateral;
    position.notional = total_notional;
    position.size = total_size;
    position.entry_price = blended_entry;
    position.leverage = effective_leverage;
    position.liquidation_price = calc_liquidation_price(blended_entry, effective_leverage, &side)?;

    Ok(())
}
