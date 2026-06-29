use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct DepositMargin<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + TraderMarginAccount::LEN,
        seeds = [b"margin", market.key().as_ref(), trader.key().as_ref()],
        bump
    )]
    pub margin_account: Account<'info, TraderMarginAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositMargin>, amount: u64) -> Result<()> {
    require!(amount > 0, ApexError::InsufficientCollateral);
    require!(
        ctx.accounts.trader_token_account.owner == ctx.accounts.trader.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.trader_token_account.mint == ctx.accounts.market.base_mint,
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.vault.mint == ctx.accounts.market.base_mint,
        ApexError::Unauthorized
    );

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.trader_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.trader.to_account_info(),
            },
        ),
        amount,
    )?;

    let margin = &mut ctx.accounts.margin_account;
    if margin.owner == Pubkey::default() {
        margin.owner = ctx.accounts.trader.key();
        margin.market = ctx.accounts.market.key();
        margin.deposited_collateral = 0;
        margin.locked_collateral = 0;
        margin.bump = ctx.bumps.margin_account;
    }
    require!(
        margin.owner == ctx.accounts.trader.key(),
        ApexError::Unauthorized
    );
    require!(
        margin.market == ctx.accounts.market.key(),
        ApexError::Unauthorized
    );

    margin.deposited_collateral = margin
        .deposited_collateral
        .checked_add(amount)
        .ok_or(ApexError::MathOverflow)?;

    Ok(())
}
