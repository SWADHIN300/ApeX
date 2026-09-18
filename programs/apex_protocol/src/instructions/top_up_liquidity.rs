use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

/// Seeds protocol liquidity so that profitable closes can be paid immediately.
///
/// A brand-new market starts with `liquidity_pool == insurance_fund == 0`, which
/// means every profitable `close_position` is deferred into a `PendingPayout`
/// until someone loses. On a balanced or net-profitable book those payouts can
/// grow faster than the pool refills, leaving winnings permanently unclaimable.
///
/// This instruction lets anyone (bots, the deployer, or LP providers) move
/// their own tokens into the vault in exchange for an equal credit to the
/// liquidity pool (or insurance fund). Credit is only ever granted against real
/// tokens that physically enter the vault, so it cannot create insolvency.
pub fn handler(ctx: Context<TopUpLiquidity>, amount: u64, target_liquidity_pool: bool) -> Result<()> {
    require!(amount > 0, ApexError::EmptyAmount);
    require!(
        ctx.accounts.payer_token_account.owner == ctx.accounts.payer.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.payer_token_account.mint == ctx.accounts.market.base_mint,
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
                from: ctx.accounts.payer_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.payer.to_account_info(),
            },
        ),
        amount,
    )?;

    let market = &mut ctx.accounts.market;
    if target_liquidity_pool {
        market.liquidity_pool = market
            .liquidity_pool
            .checked_add(amount)
            .ok_or(ApexError::MathOverflow)?;
    } else {
        market.insurance_fund = market
            .insurance_fund
            .checked_add(amount)
            .ok_or(ApexError::MathOverflow)?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct TopUpLiquidity<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub payer_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}