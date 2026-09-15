use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct WithdrawSpot<'info> {
    pub trader: Signer<'info>,
    #[account(
        has_one = base_vault,
        has_one = quote_vault,
        seeds = [b"spot_market", spot_market.base_mint.as_ref(), spot_market.quote_mint.as_ref()],
        bump = spot_market.bump,
    )]
    pub spot_market: Account<'info, SpotMarket>,
    #[account(
        mut,
        seeds = [b"spot_balance", spot_market.key().as_ref(), trader.key().as_ref()],
        bump = balance.bump,
        constraint = balance.owner == trader.key() @ ApexError::Unauthorized,
        constraint = balance.market == spot_market.key() @ ApexError::Unauthorized,
    )]
    pub balance: Account<'info, SpotBalance>,
    #[account(mut)]
    pub base_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub quote_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = trader_base_account.owner == trader.key() @ ApexError::Unauthorized,
        constraint = trader_base_account.mint == spot_market.base_mint @ ApexError::Unauthorized,
    )]
    pub trader_base_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        constraint = trader_quote_account.owner == trader.key() @ ApexError::Unauthorized,
        constraint = trader_quote_account.mint == spot_market.quote_mint @ ApexError::Unauthorized,
    )]
    pub trader_quote_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<WithdrawSpot>, base_amount: u64, quote_amount: u64) -> Result<()> {
    require!(base_amount > 0 || quote_amount > 0, ApexError::EmptyAmount);

    // Only unlocked balance may leave; anything reserved by a resting order
    // stays put until that order fills or is cancelled.
    require!(
        ctx.accounts.balance.base_free >= base_amount,
        ApexError::InsufficientSpotBalance
    );
    require!(
        ctx.accounts.balance.quote_free >= quote_amount,
        ApexError::InsufficientSpotBalance
    );

    let base_mint = ctx.accounts.spot_market.base_mint;
    let quote_mint = ctx.accounts.spot_market.quote_mint;
    let bump = ctx.accounts.spot_market.bump;
    let signer_seeds = spot_market_signer_seeds(&base_mint, &quote_mint, &bump);

    if base_amount > 0 {
        ctx.accounts.balance.base_free = ctx
            .accounts
            .balance
            .base_free
            .checked_sub(base_amount)
            .ok_or(ApexError::MathOverflow)?;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.base_vault.to_account_info(),
                    to: ctx.accounts.trader_base_account.to_account_info(),
                    authority: ctx.accounts.spot_market.to_account_info(),
                },
                &[&signer_seeds],
            ),
            base_amount,
        )?;
    }

    if quote_amount > 0 {
        ctx.accounts.balance.quote_free = ctx
            .accounts
            .balance
            .quote_free
            .checked_sub(quote_amount)
            .ok_or(ApexError::MathOverflow)?;
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.quote_vault.to_account_info(),
                    to: ctx.accounts.trader_quote_account.to_account_info(),
                    authority: ctx.accounts.spot_market.to_account_info(),
                },
                &[&signer_seeds],
            ),
            quote_amount,
        )?;
    }

    Ok(())
}
