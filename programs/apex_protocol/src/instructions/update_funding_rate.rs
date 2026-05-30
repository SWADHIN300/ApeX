use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct UpdateFundingRate<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority)]
    pub market: Account<'info, Market>,
    pub clock: Sysvar<'info, Clock>,
}

pub fn handler(ctx: Context<UpdateFundingRate>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let now = ctx.accounts.clock.unix_timestamp;
    require!(
        now >= market.last_funding_ts + FUNDING_INTERVAL,
        ApexError::FundingTooEarly
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
    market.funding_rate = i64::try_from(funding_rate).map_err(|_| ApexError::MathOverflow)?;
    market.last_funding_ts = now;

    for account_info in ctx.remaining_accounts.iter() {
        if account_info.owner != ctx.program_id {
            continue;
        }
        let mut data = account_info.try_borrow_mut_data()?;
        if data.len() < 8 {
            continue;
        }
        let mut slice: &[u8] = &data[8..];
        let mut position = Position::try_deserialize_unchecked(&mut slice)?;
        if position.market != market.key() {
            continue;
        }
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
        let mut out = Vec::with_capacity(Position::LEN);
        position.try_serialize(&mut out)?;
        data[8..8 + out.len()].copy_from_slice(&out);
    }

    emit!(FundingUpdated {
        funding_rate: market.funding_rate,
        timestamp: now,
    });

    Ok(())
}
