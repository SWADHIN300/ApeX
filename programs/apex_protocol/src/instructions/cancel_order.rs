use anchor_lang::prelude::*;

use crate::*;

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    pub signer: Signer<'info>,
    pub market: Account<'info, Market>,
    #[account(mut, has_one = market)]
    pub order_book: Account<'info, OrderBook>,
}

pub fn handler(ctx: Context<CancelOrder>, order_index: u64, side: Side) -> Result<()> {
    let orders = match side {
        Side::Long => &mut ctx.accounts.order_book.bids,
        Side::Short => &mut ctx.accounts.order_book.asks,
    };
    let index = usize::try_from(order_index).map_err(|_| ApexError::InvalidOrderIndex)?;
    require!(index < orders.len(), ApexError::InvalidOrderIndex);
    let order = &orders[index];
    require!(
        order.owner == ctx.accounts.signer.key(),
        ApexError::Unauthorized
    );
    require!(order.status == OrderStatus::Open, ApexError::OrderNotOpen);

    orders.swap_remove(index);
    match side {
        Side::Long => orders.sort_by(|a, b| b.price.cmp(&a.price)),
        Side::Short => orders.sort_by(|a, b| a.price.cmp(&b.price)),
    }

    Ok(())
}
