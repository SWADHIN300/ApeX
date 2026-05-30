use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, has_one = vault, has_one = oracle)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        close = owner,
        seeds = [b"position", market.key().as_ref(), owner.key().as_ref()],
        bump = position.bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    /// CHECK: validated by Pyth parser
    pub oracle: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClosePosition>) -> Result<()> {
    require!(
        ctx.accounts.owner.key() == ctx.accounts.position.owner,
        ApexError::Unauthorized
    );

    let clock = Clock::get()?;
    let exit_price = get_oracle_price(&ctx.accounts.oracle, &clock)?;
    let position = &ctx.accounts.position;
    let realized_pnl = calc_pnl(
        &position.side,
        position.entry_price,
        exit_price,
        position.size,
    )?;
    let fee_base = position
        .collateral
        .checked_add(realized_pnl.max(0) as u64)
        .ok_or(ApexError::MathOverflow)?;
    let fee = fee_base
        .checked_mul(ctx.accounts.market.fee_rate)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(FEE_DENOMINATOR)
        .ok_or(ApexError::MathOverflow)?;
    let payout_i128 = position.collateral as i128 + realized_pnl as i128 - fee as i128;
    let notional = calc_notional(position.collateral, position.leverage)?;

    if payout_i128 > 0 {
        let payout = u64::try_from(payout_i128).map_err(|_| ApexError::InvalidPayout)?;
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
            payout,
        )?;
    } else {
        let bad_debt = payout_i128.unsigned_abs() as u64;
        ctx.accounts.market.insurance_fund =
            ctx.accounts.market.insurance_fund.saturating_sub(bad_debt);
    }

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

    emit!(PositionClosed {
        owner: ctx.accounts.owner.key(),
        realized_pnl,
        exit_price,
    });

    Ok(())
}
