use anchor_lang::prelude::*;

use crate::constants::MAX_ORDERS;
use crate::state::Side;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum OrderStatus {
    Open,
    Filled,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Order {
    pub owner: Pubkey,
    pub side: Side,
    pub price: u64,
    pub size: u64,
    pub locked_collateral: u64,
    pub leverage: u8,
    pub status: OrderStatus,
    pub created_at: i64,
}

impl Order {
    pub const LEN: usize = 32 + 1 + 8 + 8 + 8 + 1 + 1 + 8;
}

#[account]
pub struct OrderBook {
    pub market: Pubkey,
    pub asks: Vec<Order>,
    pub bids: Vec<Order>,
    pub bump: u8,
}

impl OrderBook {
    pub const LEN: usize = 32 + 4 + (Order::LEN * MAX_ORDERS) + 4 + (Order::LEN * MAX_ORDERS) + 1;
}
