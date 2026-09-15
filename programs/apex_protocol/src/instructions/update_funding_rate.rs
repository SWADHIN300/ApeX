use anchor_lang::prelude::*;
use anchor_lang::AnchorSerialize;

use crate::*;

#[derive(Accounts)]
pub struct UpdateFundingRate<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub market: Account<'info, Market>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(ctx: Context<UpdateFundingRate>) -> Result<()> {
    let market_key = ctx.accounts.market.key();
    let market = &mut ctx.accounts.market;
    let now = ctx.accounts.clock.unix_timestamp;
    require!(
        now >= market
            .last_funding_ts
            .checked_add(FUNDING_INTERVAL)
            .ok_or(ApexError::MathOverflow)?,
        ApexError::FundingTooEarly
    );

    // Bound the account list so this instruction cannot be used to grind
    // through an unbounded set of accounts in a single call.
    require!(
        ctx.remaining_accounts.len() <= MAX_FUNDING_ACCOUNTS,
        ApexError::TooManyAccounts
    );

    let total_oi = market
        .open_interest_long
        .checked_add(market.open_interest_short)
        .ok_or(ApexError::MathOverflow)?;
    if total_oi == 0 {
        market.funding_rate = 0;
        market.last_funding_ts = now;
        emit!(FundingUpdated {
            funding_rate: 0,
            timestamp: now,
        });
        return Ok(());
    }

    let imbalance = market.open_interest_long as i128 - market.open_interest_short as i128;
    let funding_rate = imbalance
        .checked_mul(BASE_FUNDING_RATE as i128)
        .ok_or(ApexError::MathOverflow)?
        .checked_div(total_oi as i128)
        .ok_or(ApexError::MathOverflow)?;
    let funding_rate = i64::try_from(funding_rate).map_err(|_| ApexError::MathOverflow)?;
    // Clamp so a corrupted or manipulated OI imbalance cannot translate into an
    // unbounded PnL adjustment across every open position.
    market.funding_rate = clamp_funding_rate(funding_rate);
    market.last_funding_ts = now;

    // Track which position accounts have already been settled in this call.
    // Without this, the same account could be passed multiple times and have
    // funding applied repeatedly in a single instruction.
    let mut settled: Vec<Pubkey> = Vec::with_capacity(ctx.remaining_accounts.len());

    for account_info in ctx.remaining_accounts.iter() {
        if account_info.owner != ctx.program_id {
            continue;
        }
        // Position accounts must be passed as writable to receive updates.
        require!(account_info.is_writable, ApexError::Unauthorized);

        let account_key = *account_info.key;
        if settled.contains(&account_key) {
            continue;
        }

        let mut data = account_info.try_borrow_mut_data()?;
        if data.len() < 8 + Position::LEN {
            continue;
        }

        // try_deserialize validates the 8-byte discriminator, so arbitrary
        // program-owned accounts cannot be coerced into a Position.
        let mut slice: &[u8] = &data;
        let mut position = match Position::try_deserialize(&mut slice) {
            Ok(p) => p,
            Err(_) => continue, // not a Position account — skip
        };

        if position.market != market_key {
            continue;
        }
        if position.size == 0 {
            continue;
        }

        // Confirm this really is the canonical PDA for (market, owner). This is
        // what stops a caller from supplying a look-alike program-owned account
        // and having protocol state written into it.
        let (expected_key, _) = Pubkey::find_program_address(
            &[b"position", market_key.as_ref(), position.owner.as_ref()],
            ctx.program_id,
        );
        require_keys_eq!(
            expected_key,
            account_key,
            ApexError::InvalidPositionAccount
        );

        let funding_delta = (position.size as i128)
            .checked_mul(market.funding_rate as i128)
            .ok_or(ApexError::MathOverflow)?
            .checked_div(FEE_DENOMINATOR as i128)
            .ok_or(ApexError::MathOverflow)?;
        let funding_delta = i64::try_from(funding_delta).map_err(|_| ApexError::MathOverflow)?;
        match position.side {
            Side::Long => {
                position.unrealized_pnl = position
                    .unrealized_pnl
                    .checked_sub(funding_delta)
                    .ok_or(ApexError::MathOverflow)?;
            }
            Side::Short => {
                position.unrealized_pnl = position
                    .unrealized_pnl
                    .checked_add(funding_delta)
                    .ok_or(ApexError::MathOverflow)?;
            }
        }
        position.funding_settled = position
            .funding_settled
            .checked_add(market.funding_rate)
            .ok_or(ApexError::MathOverflow)?;

        // Serialize ONLY the struct fields (no discriminator prefix) via
        // AnchorSerialize so it maps exactly to data[8..].
        let mut out = Vec::with_capacity(Position::LEN);
        AnchorSerialize::serialize(&position, &mut out)?;
        require!(out.len() <= data.len() - 8, ApexError::MathOverflow);
        data[8..8 + out.len()].copy_from_slice(&out);

        settled.push(account_key);
    }

    emit!(FundingUpdated {
        funding_rate: market.funding_rate,
        timestamp: now,
    });

    Ok(())
}
