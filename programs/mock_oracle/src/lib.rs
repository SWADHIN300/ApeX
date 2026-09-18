//! A minimal mock oracle whose feed accounts are byte-laid-out EXACTLY like a
//! Pyth price feed. ApeX's `get_oracle_price` only reads a fixed set of offsets
//! and never checks the account's owner, so this feed is accepted by the
//! protocol without depending on Pyth's devnet deployment.
//!
//! This is for devnet / testing only. Never use on mainnet.

use solana_program::{
    account_info::AccountInfo, entrypoint, entrypoint::ProgramResult, msg,
    program_error::ProgramError, pubkey::Pubkey, sysvar::Sysvar,
};

const PYTH_MAGIC: u32 = 0xa1b2c3d4;
const PYTH_VERSION: u32 = 2;
const PYTH_PRICE_ACCOUNT_TYPE: u32 = 3;
const STATUS_TRADING: u8 = 1;

const OFF_MAGIC: usize = 0;
const OFF_VERSION: usize = 4;
const OFF_TYPE: usize = 8;
const OFF_EXPO: usize = 20;
const OFF_TS: usize = 96;
const OFF_PREV_PRICE: usize = 184;
const OFF_PREV_CONF: usize = 192;
const OFF_PREV_TS: usize = 200;
const OFF_AGG_PRICE: usize = 208;
const OFF_AGG_CONF: usize = 216;
const OFF_AGG_STATUS: usize = 224;

const FEED_SPACE: usize = 240;

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let tag = instruction_data[0];
    match tag {
        0 => initialize(program_id, accounts, &instruction_data[1..]),
        1 => update(accounts, &instruction_data[1..]),
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

/// initialize: fill a pre-created feed account (owned by this program or any
/// caller-exempt account) with Pyth-layout data.
///
/// The caller must first create the account (space = FEED_SPACE) via
/// `SystemProgram.createAccount` and fund it with rent. This keeps the program
/// tiny and avoids a create-account CPI.
///
/// accounts: [feed (writable)]
/// data after tag: price:u64 (raw, 6 decimals), expo:i32
fn initialize(_program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let feed = &accounts[0];
    let price = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let expo = i32::from_le_bytes(data[8..12].try_into().unwrap());
    if feed.data_len() < FEED_SPACE {
        return Err(ProgramError::AccountDataTooSmall);
    }
    let now = solana_program::sysvar::clock::Clock::get()?.unix_timestamp;
    write_feed(feed, price, expo, now)?;
    msg!("mock_oracle: initialized feed {} at {}", feed.key, price);
    Ok(())
}

/// update: set a new price + timestamp on a feed.
/// accounts: [feed (writable)]
/// data after tag: price:u64
fn update(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let feed = &accounts[0];
    let price = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let expo = i32::from_le_bytes(feed.try_borrow_data()?[OFF_EXPO..OFF_EXPO + 4].try_into().unwrap());
    let now = solana_program::sysvar::clock::Clock::get()?.unix_timestamp;
    write_feed(feed, price, expo, now)?;
    msg!("mock_oracle: updated feed {} to {}", feed.key, price);
    Ok(())
}

fn write_feed(feed: &AccountInfo, price: u64, expo: i32, now: i64) -> ProgramResult {
    let mut d = feed.try_borrow_mut_data()?;
    d[OFF_MAGIC..OFF_MAGIC + 4].copy_from_slice(&PYTH_MAGIC.to_le_bytes());
    d[OFF_VERSION..OFF_VERSION + 4].copy_from_slice(&PYTH_VERSION.to_le_bytes());
    d[OFF_TYPE..OFF_TYPE + 4].copy_from_slice(&PYTH_PRICE_ACCOUNT_TYPE.to_le_bytes());
    d[OFF_EXPO..OFF_EXPO + 4].copy_from_slice(&expo.to_le_bytes());
    d[OFF_TS..OFF_TS + 8].copy_from_slice(&now.to_le_bytes());
    let price_i = price as i64;
    d[OFF_PREV_PRICE..OFF_PREV_PRICE + 8].copy_from_slice(&price_i.to_le_bytes());
    d[OFF_PREV_CONF..OFF_PREV_CONF + 8].copy_from_slice(&10u64.to_le_bytes());
    d[OFF_PREV_TS..OFF_PREV_TS + 8].copy_from_slice(&now.to_le_bytes());
    d[OFF_AGG_PRICE..OFF_AGG_PRICE + 8].copy_from_slice(&price_i.to_le_bytes());
    d[OFF_AGG_CONF..OFF_AGG_CONF + 8].copy_from_slice(&10u64.to_le_bytes());
    d[OFF_AGG_STATUS] = STATUS_TRADING;
    Ok(())
}

/// Expose the layout constants to the outside for tests/scripts.
#[allow(dead_code)]
mod api {
    pub const FEED_SPACE: usize = super::FEED_SPACE;
    pub const OFF_AGG_PRICE: usize = super::OFF_AGG_PRICE;
    pub const OFF_EXPO: usize = super::OFF_EXPO;
    pub const OFF_TS: usize = super::OFF_TS;
    pub const PYTH_AGGR_STATUS_TRADING: u8 = super::STATUS_TRADING;
}