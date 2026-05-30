use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::*;

#[derive(Accounts)]
pub struct OpenPosition<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(mut, has_one = vault, has_one = oracle)]
    pub market: Account<'info, Market>,
    #[account(
        init,
        payer = trader,
        space = 8 + Position::LEN,
        seeds = [b"position", market.key().as_ref(), trader.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub trader_token_account: Account<'info, TokenAccount>,
    /// CHECK: validated by Pyth parser
    pub oracle: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<OpenPosition>,
    side: Side,
    collateral: u64,
    leverage: u8,
) -> Result<()> {
    validate_leverage(leverage)?;
    require!(collateral > 0, ApexError::InsufficientCollateral);

    let clock = Clock::get()?;
    let entry_price = get_oracle_price(&ctx.accounts.oracle, &clock)?;
    let notional = calc_notional(collateral, leverage)?;
    let size = calc_size(notional, entry_price)?;
    let liquidation_price = calc_liquidation_price(entry_price, leverage, &side)?;

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.trader_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.trader.to_account_info(),
            },
        ),
        collateral,
    )?;

    let position = &mut ctx.accounts.position;
    position.owner = ctx.accounts.trader.key();
    position.market = ctx.accounts.market.key();
    position.side = side.clone();
    position.collateral = collateral;
    position.size = size;
    position.entry_price = entry_price;
    position.leverage = leverage;
    position.liquidation_price = liquidation_price;
    position.unrealized_pnl = 0;
    position.funding_settled = 0;
    position.created_at = clock.unix_timestamp;
    position.bump = ctx.bumps.position;

    let market = &mut ctx.accounts.market;
    match side {
        Side::Long => {
            market.open_interest_long = market
                .open_interest_long
                .checked_add(notional)
                .ok_or(ApexError::MathOverflow)?;
        }
        Side::Short => {
            market.open_interest_short = market
                .open_interest_short
                .checked_add(notional)
                .ok_or(ApexError::MathOverflow)?;
        }
    }

    emit!(PositionOpened {
        owner: ctx.accounts.trader.key(),
        side,
        entry_price,
        size,
        leverage,
        liquidation_price,
    });

    Ok(())
}
