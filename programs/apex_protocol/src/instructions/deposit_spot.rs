use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct DepositSpot<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(
        has_one = base_vault,
        has_one = quote_vault,
        seeds = [b"spot_market", spot_market.base_mint.as_ref(), spot_market.quote_mint.as_ref()],
        bump = spot_market.bump,
    )]
    pub spot_market: Account<'info, SpotMarket>,
    #[account(
        init_if_needed,
        payer = trader,
        space = 8 + SpotBalance::LEN,
        seeds = [b"spot_balance", spot_market.key().as_ref(), trader.key().as_ref()],
        bump
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<DepositSpot>, base_amount: u64, quote_amount: u64) -> Result<()> {
    require!(base_amount > 0 || quote_amount > 0, ApexError::EmptyAmount);

    let balance = &mut ctx.accounts.balance;
    if balance.owner == Pubkey::default() {
        balance.owner = ctx.accounts.trader.key();
        balance.market = ctx.accounts.spot_market.key();
        balance.base_free = 0;
        balance.base_locked = 0;
        balance.quote_free = 0;
        balance.quote_locked = 0;
        balance.bump = ctx.bumps.balance;
    }
    require_keys_eq!(balance.owner, ctx.accounts.trader.key(), ApexError::Unauthorized);
    require_keys_eq!(
        balance.market,
        ctx.accounts.spot_market.key(),
        ApexError::Unauthorized
    );

    if base_amount > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trader_base_account.to_account_info(),
                    to: ctx.accounts.base_vault.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            base_amount,
        )?;
        balance.base_free = balance
            .base_free
            .checked_add(base_amount)
            .ok_or(ApexError::MathOverflow)?;
    }

    if quote_amount > 0 {
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.trader_quote_account.to_account_info(),
                    to: ctx.accounts.quote_vault.to_account_info(),
                    authority: ctx.accounts.trader.to_account_info(),
                },
            ),
            quote_amount,
        )?;
        balance.quote_free = balance
            .quote_free
            .checked_add(quote_amount)
            .ok_or(ApexError::MathOverflow)?;
    }

    Ok(())
}
