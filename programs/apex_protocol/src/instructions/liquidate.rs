use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub keeper: Signer<'info>,
    #[account(mut, has_one = vault, has_one = oracle)]
    pub market: Account<'info, Market>,
    #[account(mut, close = keeper, has_one = market)]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub keeper_token_account: Account<'info, TokenAccount>,
    /// CHECK: validated by Pyth parser
    pub oracle: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Liquidate>) -> Result<()> {
    let clock = Clock::get()?;
    let mark_price = get_oracle_price(&ctx.accounts.oracle, &clock)?;
    let position = &ctx.accounts.position;
    let liquidatable = match position.side {
        Side::Long => mark_price <= position.liquidation_price,
        Side::Short => mark_price >= position.liquidation_price,
    };
    require!(liquidatable, ApexError::PositionNotLiquidatable);

    let keeper_fee = position
        .collateral
        .checked_mul(LIQUIDATION_FEE)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(FEE_DENOMINATOR)
        .ok_or(ApexError::MathOverflow)?;
    let remaining = position
        .collateral
        .checked_sub(keeper_fee)
        .ok_or(ApexError::MathOverflow)?;
    let notional = calc_notional(position.collateral, position.leverage)?;

    let signer_seeds =
        market_signer_seeds(&ctx.accounts.market.base_mint, &ctx.accounts.market.bump);
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.keeper_token_account.to_account_info(),
                authority: ctx.accounts.market.to_account_info(),
            },
            &[&signer_seeds],
        ),
        keeper_fee,
    )?;

    match position.side {
        Side::Long => {
            ctx.accounts.market.open_interest_long = ctx
                .accounts
                .market
                .open_interest_long
                .saturating_sub(notional);
        }
        Side::Short => {
            ctx.accounts.market.open_interest_short = ctx
                .accounts
                .market
                .open_interest_short
                .saturating_sub(notional);
        }
    }
    ctx.accounts.market.insurance_fund = ctx
        .accounts
        .market
        .insurance_fund
        .checked_add(remaining)
        .ok_or(ApexError::MathOverflow)?;

    emit!(PositionLiquidated {
        owner: position.owner,
        keeper: ctx.accounts.keeper.key(),
        mark_price,
        collateral_seized: position.collateral,
    });

    Ok(())
}
