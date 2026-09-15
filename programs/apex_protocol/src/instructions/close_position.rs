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
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + PendingPayout::LEN,
        seeds = [b"pending_payout", market.key().as_ref(), owner.key().as_ref()],
        bump
    )]
    pub pending_payout: Account<'info, PendingPayout>,
    #[account(mut, constraint = vault.mint == market.base_mint @ ApexError::Unauthorized)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    /// CHECK: validated by Pyth parser
    pub oracle: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClosePosition>, price_limit: u64) -> Result<()> {
    require!(
        ctx.accounts.owner.key() == ctx.accounts.position.owner,
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.trader_token_account.owner == ctx.accounts.owner.key(),
        ApexError::Unauthorized
    );
    require!(
        ctx.accounts.trader_token_account.mint == ctx.accounts.market.base_mint,
        ApexError::Unauthorized
    );

    let clock = Clock::get()?;
    let exit_price = get_oracle_price(&ctx.accounts.oracle, &clock)?;
    let position = &ctx.accounts.position;
    // Reject exits worse than the caller's tolerance before settling.
    enforce_exit_price_limit(&position.side, exit_price, price_limit)?;

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
    let requested_payout = if payout_i128 > 0 {
        u64::try_from(payout_i128).map_err(|_| ApexError::InvalidPayout)?
    } else {
        0
    };
    // Use the exact notional recorded at fill time. Recomputing it from
    // collateral * leverage drifts, because leverage is rounded up on blending,
    // which used to make open interest saturate toward zero.
    let notional = position.notional;

    ctx.accounts.market.insurance_fund = ctx
        .accounts
        .market
        .insurance_fund
        .checked_add(fee)
        .ok_or(ApexError::MathOverflow)?;

    let immediate_payout = settle_close_accounting(
        &mut ctx.accounts.market,
        position.collateral,
        requested_payout,
    )?;
    let deferred_payout = requested_payout
        .checked_sub(immediate_payout)
        .ok_or(ApexError::MathOverflow)?;

    if immediate_payout > 0 {
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
            immediate_payout,
        )?;
    }

    if deferred_payout > 0 {
        let pending = &mut ctx.accounts.pending_payout;
        if pending.owner == Pubkey::default() {
            pending.owner = ctx.accounts.owner.key();
            pending.market = ctx.accounts.market.key();
            pending.amount = 0;
            pending.created_at = clock.unix_timestamp;
            pending.bump = ctx.bumps.pending_payout;
        }
        require!(
            pending.owner == ctx.accounts.owner.key(),
            ApexError::Unauthorized
        );
        require!(
            pending.market == ctx.accounts.market.key(),
            ApexError::Unauthorized
        );
        pending.amount = pending
            .amount
            .checked_add(deferred_payout)
            .ok_or(ApexError::MathOverflow)?;
        ctx.accounts.market.pending_payouts_total = ctx
            .accounts
            .market
            .pending_payouts_total
            .checked_add(deferred_payout)
            .ok_or(ApexError::MathOverflow)?;
        // Recoverable later via `claim_pending_payout` once pools refill.
        msg!(
            "Payout of {} deferred to pending_payout PDA; claim once liquidity recovers",
            deferred_payout
        );
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

/// Splits a close into the part payable immediately and the part that must be
/// deferred. Profit is drawn from the liquidity pool first, then the insurance
/// fund.
///
/// The pools are the single source of truth for what is payable: whatever they
/// cannot cover becomes a `PendingPayout` and is debited from the pools later,
/// when it is actually claimed. Capping this figure by the vault's token balance
/// would debit the pools here *and* again at claim time for the same amount, so
/// the vault is deliberately not consulted. If the vault were ever short of its
/// obligations the transfer below fails and the whole close reverts, which is
/// the correct outcome.
fn settle_close_accounting<'info>(
    market: &mut Account<'info, Market>,
    collateral: u64,
    requested_payout: u64,
) -> Result<u64> {
    if requested_payout <= collateral {
        let retained = collateral
            .checked_sub(requested_payout)
            .ok_or(ApexError::MathOverflow)?;
        market.liquidity_pool = market
            .liquidity_pool
            .checked_add(retained)
            .ok_or(ApexError::MathOverflow)?;
        return Ok(requested_payout);
    }

    let profit_needed = requested_payout
        .checked_sub(collateral)
        .ok_or(ApexError::MathOverflow)?;
    let profit_from_pool = profit_needed.min(market.liquidity_pool);
    market.liquidity_pool = market
        .liquidity_pool
        .checked_sub(profit_from_pool)
        .ok_or(ApexError::MathOverflow)?;

    let remaining_profit = profit_needed
        .checked_sub(profit_from_pool)
        .ok_or(ApexError::MathOverflow)?;
    let profit_from_insurance = remaining_profit.min(market.insurance_fund);
    market.insurance_fund = market
        .insurance_fund
        .checked_sub(profit_from_insurance)
        .ok_or(ApexError::MathOverflow)?;

    collateral
        .checked_add(profit_from_pool)
        .and_then(|amount| amount.checked_add(profit_from_insurance))
        .ok_or(ApexError::MathOverflow.into())
}
