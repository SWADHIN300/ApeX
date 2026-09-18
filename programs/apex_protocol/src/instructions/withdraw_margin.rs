use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct WithdrawMargin<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"margin", market.key().as_ref(), trader.key().as_ref()],
        bump = margin_account.bump
    )]
    pub margin_account: Account<'info, TraderMarginAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawMargin>, amount: u64) -> Result<()> {
    require!(amount > 0, ApexError::InsufficientCollateral);
    require!(
        ctx.accounts.margin_account.owner == ctx.accounts.trader.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.margin_account.market == ctx.accounts.market.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.trader_token_account.owner == ctx.accounts.trader.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.trader_token_account.mint == ctx.accounts.market.base_mint,
        ApexError::Unauthorized
    );

    let available = ctx
        .accounts
        .margin_account
        .deposited_collateral
        .checked_sub(ctx.accounts.margin_account.locked_collateral)
        .ok_or(ApexError::MathOverflow)?;
    require!(available >= amount, ApexError::InsufficientCollateral);

    // Solvency guard: after this withdrawal the vault must still physically
    // back every protocol-owned claim and margin obligation (liquidity pool,
    // insurance fund, deferred payouts, and the committed protocol-level
    // margin total). This stops withdrawals from ever draining reserves that
    // belong to other traders or the protocol itself.
    let committed = ctx
        .accounts
        .market
        .liquidity_pool
        .checked_add(ctx.accounts.market.insurance_fund)
        .and_then(|v| v.checked_add(ctx.accounts.market.pending_payouts_total))
        .ok_or(ApexError::MathOverflow)?;

    // We cannot know the sum of all deposited_collateral across margin
    // accounts from this single account, but we can approximate the
    // protocol-wide margin obligation as (liquidity_pool + insurance_fund +
    // pending_payouts_total + this account's remaining deposited_collateral).
    // The vault must hold at least this much after the withdrawal.
    // This is a conservative lower bound: the true total of all margin
    // deposits could be higher, so a single withdrawal passing this guard
    // does not guarantee full solvency for all traders simultaneously.
    let remaining_margin = ctx
        .accounts
        .margin_account
        .deposited_collateral
        .checked_sub(amount)
        .ok_or(ApexError::MathOverflow)?;
    let obligation = committed
        .checked_add(remaining_margin)
        .ok_or(ApexError::MathOverflow)?;
    let vault_after = ctx
        .accounts
        .vault
        .amount
        .checked_sub(amount)
        .ok_or(ApexError::MathOverflow)?;
    require!(
        vault_after >= obligation,
        ApexError::InsufficientProtocolLiquidity
    );

    ctx.accounts.margin_account.deposited_collateral = remaining_margin;

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
        amount,
    )?;

    Ok(())
}
