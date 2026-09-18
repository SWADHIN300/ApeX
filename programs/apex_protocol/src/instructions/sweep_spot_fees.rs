use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

/// Let the spot-market authority withdraw the fees accumulated by `match_spot_orders`.
///
/// Fills charge a taker fee that is credited to `SpotMarket.fees_accrued` and held
/// in the quote vault. Previously there was no way to ever extract it — the fee
/// balance grew in the vault forever, which also conceptually blocked a user's
/// quote withdrawal (via the withdraw_spot solvency guard). This instruction
/// sweeps the accrued fees out to the authority's own token account.
pub fn handler(ctx: Context<SweepSpotFees>) -> Result<()> {
    let amount = ctx
        .accounts
        .spot_market
        .fees_accrued
        .min(ctx.accounts.quote_vault.amount);
    require!(amount > 0, ApexError::EmptyAmount);

    let base_mint = ctx.accounts.spot_market.base_mint;
    let quote_mint = ctx.accounts.spot_market.quote_mint;
    let bump = ctx.accounts.spot_market.bump;
    let signer_seeds = spot_market_signer_seeds(&base_mint, &quote_mint, &bump);

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.quote_vault.to_account_info(),
                to: ctx.accounts.authority_token_account.to_account_info(),
                authority: ctx.accounts.spot_market.to_account_info(),
            },
            &[&signer_seeds],
        ),
        amount,
    )?;

    ctx.accounts.spot_market.fees_accrued = ctx
        .accounts
        .spot_market
        .fees_accrued
        .checked_sub(amount)
        .ok_or(ApexError::MathOverflow)?;

    Ok(())
}

#[derive(Accounts)]
pub struct SweepSpotFees<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        has_one = quote_vault,
        seeds = [b"spot_market", spot_market.base_mint.as_ref(), spot_market.quote_mint.as_ref()],
        bump = spot_market.bump,
    )]
    pub spot_market: Account<'info, SpotMarket>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = authority_token_account.owner == authority.key() @ ApexError::Unauthorized,
        constraint = authority_token_account.mint == spot_market.quote_mint @ ApexError::Unauthorized,
    )]
    pub authority_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}