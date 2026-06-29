use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

use crate::*;

#[derive(Accounts)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub market: Account<'info, Market>,
    #[account(mut, has_one = market)]
    pub order_book: Account<'info, OrderBook>,
    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + TraderMarginAccount::LEN,
        seeds = [b"margin", market.key().as_ref(), signer.key().as_ref()],
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

pub fn handler(
    ctx: Context<PlaceOrder>,
    side: Side,
    price: u64,
    size: u64,
    leverage: u8,
) -> Result<()> {
    validate_leverage(leverage)?;
    require!(price > 0 && size > 0, ApexError::InsufficientCollateral);
    require!(
        ctx.accounts.trader_token_account.owner == ctx.accounts.signer.key(),
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

    let locked_collateral = (size as u128)
        .checked_add(leverage as u128 - 1)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(leverage as u128)
        .ok_or(ApexError::MathOverflow)?;
    let locked_collateral =
        u64::try_from(locked_collateral).map_err(|_| ApexError::MathOverflow)?;
    require!(locked_collateral > 0, ApexError::InsufficientCollateral);

    let order_book = &mut ctx.accounts.order_book;
    require!(
        order_book.asks.len() + order_book.bids.len() < MAX_ORDERS,
        ApexError::OrderBookFull
    );

    let margin = &mut ctx.accounts.margin_account;
    if margin.owner == Pubkey::default() {
        margin.owner = ctx.accounts.signer.key();
        margin.market = ctx.accounts.market.key();
        margin.deposited_collateral = 0;
        margin.locked_collateral = 0;
        margin.bump = ctx.bumps.margin_account;
    }
    require!(
        margin.owner == ctx.accounts.signer.key(),
        ApexError::Unauthorized
    );
    require!(
        margin.market == ctx.accounts.market.key(),
        ApexError::Unauthorized
    );
    let available_collateral = margin
        .deposited_collateral
        .checked_sub(margin.locked_collateral)
        .ok_or(ApexError::MathOverflow)?;
    require!(
        available_collateral >= locked_collateral,
        ApexError::InsufficientCollateral
    );
    margin.locked_collateral = margin
        .locked_collateral
        .checked_add(locked_collateral)
        .ok_or(ApexError::MathOverflow)?;

    let order = Order {
        owner: ctx.accounts.signer.key(),
        side: side.clone(),
        price,
        size,
        locked_collateral,
        leverage,
        status: OrderStatus::Open,
        created_at: Clock::get()?.unix_timestamp,
    };

    match side {
        Side::Long => {
            order_book.bids.push(order);
            order_book.bids.sort_by(|a, b| b.price.cmp(&a.price));
        }
        Side::Short => {
            order_book.asks.push(order);
            order_book.asks.sort_by(|a, b| a.price.cmp(&b.price));
        }
    }

    Ok(())
}
