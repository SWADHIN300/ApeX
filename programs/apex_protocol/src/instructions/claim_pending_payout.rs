use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

/// Claims a payout that `close_position` deferred because the protocol's
/// liquidity pool and insurance fund could not cover the trader's profit at
/// close time. Balances accumulate in the `PendingPayout` PDA and become
/// claimable as the pools refill.
#[derive(Accounts)]
pub struct ClaimPendingPayout<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"pending_payout", market.key().as_ref(), owner.key().as_ref()],
        bump = pending_payout.bump,
        constraint = pending_payout.owner == owner.key() @ ApexError::Unauthorized,
        constraint = pending_payout.market == market.key() @ ApexError::Unauthorized,
    )]
    pub pending_payout: Account<'info, PendingPayout>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = trader_token_account.owner == owner.key() @ ApexError::Unauthorized,
        constraint = trader_token_account.mint == market.base_mint @ ApexError::Unauthorized,
    )]
    pub trader_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimPendingPayout>) -> Result<()> {
    let outstanding = ctx.accounts.pending_payout.amount;
    require!(outstanding > 0, ApexError::NoPendingPayout);

    // Only pay out what the protocol can actually back right now, and never
    // more than the vault physically holds.
    let backing = ctx
        .accounts
        .market
        .liquidity_pool
        .checked_add(ctx.accounts.market.insurance_fund)
        .ok_or(ApexError::MathOverflow)?;
    let claimable = outstanding.min(backing).min(ctx.accounts.vault.amount);
    require!(claimable > 0, ApexError::InsufficientProtocolLiquidity);

    // Draw from the liquidity pool first, then the insurance fund.
    let from_pool = claimable.min(ctx.accounts.market.liquidity_pool);
    ctx.accounts.market.liquidity_pool = ctx
        .accounts
        .market
        .liquidity_pool
        .checked_sub(from_pool)
        .ok_or(ApexError::MathOverflow)?;
    let from_insurance = claimable
        .checked_sub(from_pool)
        .ok_or(ApexError::MathOverflow)?;
    ctx.accounts.market.insurance_fund = ctx
        .accounts
        .market
        .insurance_fund
        .checked_sub(from_insurance)
        .ok_or(ApexError::MathOverflow)?;

    ctx.accounts.pending_payout.amount = outstanding
        .checked_sub(claimable)
        .ok_or(ApexError::MathOverflow)?;
    ctx.accounts.market.pending_payouts_total = ctx
        .accounts
        .market
        .pending_payouts_total
        .checked_sub(claimable)
        .ok_or(ApexError::MathOverflow)?;

    let signer_seeds =
        market_signer_seeds(&ctx.accounts.market.base_mint, &ctx.accounts.market.bump);
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.trader_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            &[&signer_seeds],
        ),
        claimable,
    )?;

    emit!(PendingPayoutClaimed {
        owner: ctx.accounts.owner.key(),
        amount: claimable,
        remaining: ctx.accounts.pending_payout.amount,
    });

    Ok(())
}
