use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::*;

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    pub signer: Signer<'info>,
    #[account(has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(mut, has_one = market)]
    pub order_book: Account<'info, OrderBook>,
    #[account(
        mut,
        seeds = [b"margin", market.key().as_ref(), signer.key().as_ref()],
        bump = margin_account.bump
    )]
    pub margin_account: Account<'info, TraderMarginAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelOrder>, order_index: u64, side: Side) -> Result<()> {
    require!(
        ctx.accounts.trader_token_account.owner == ctx.accounts.signer.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.trader_token_account.mint == ctx.accounts.market.base_mint,
        ApexError::Unauthorized
    );

    let orders = match side {
        Side::Long => &mut ctx.accounts.order_book.bids,
        Side::Short => &mut ctx.accounts.order_book.asks,
    };
    let index = usize::try_from(order_index).map_err(|_| ApexError::InvalidOrderIndex)?;
    require!(index < orders.len(), ApexError::InvalidOrderIndex);
    let order = &orders[index];
    require!(
        order.owner == ctx.accounts.signer.key(),
        ApexError::Unauthorized
    );
    require!(order.status == OrderStatus::Open, ApexError::OrderNotOpen);

    let refund = order.locked_collateral;
    require!(
        ctx.accounts.margin_account.locked_collateral >= refund,
        ApexError::InsufficientLockedCollateral
    );
    ctx.accounts.margin_account.locked_collateral = ctx
        .accounts
        .margin_account
        .locked_collateral
        .checked_sub(refund)
        .ok_or(ApexError::MathOverflow)?;

    orders.swap_remove(index);
    match side {
        Side::Long => orders.sort_by(|a, b| b.price.cmp(&a.price)),
        Side::Short => orders.sort_by(|a, b| a.price.cmp(&b.price)),
    }

    Ok(())
}
