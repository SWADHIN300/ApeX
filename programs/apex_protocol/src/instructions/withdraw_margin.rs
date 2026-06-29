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

    ctx.accounts.margin_account.deposited_collateral = ctx
        .accounts
        .margin_account
        .deposited_collateral
        .checked_sub(amount)
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
        amount,
    )?;

    Ok(())
}
