use anchor_lang::prelude::*;

#[error_code]
pub enum ApexError {
    #[msg("Collateral amount is insufficient for this position")]
    InsufficientCollateral,
    #[msg("Leverage must be between 1 and 10")]
    InvalidLeverage,
    #[msg("Position has not reached liquidation threshold")]
    PositionNotLiquidatable,
    #[msg("Oracle price is stale or confidence too wide")]
    OraclePriceStale,
    #[msg("Order book has reached maximum capacity")]
    OrderBookFull,
    #[msg("Signer is not authorized for this action")]
    Unauthorized,
    #[msg("Funding rate update called too early")]
    FundingTooEarly,
    #[msg("Position already exists for this market and owner")]
    PositionAlreadyExists,
    #[msg("Arithmetic overflow in PnL calculation")]
    MathOverflow,
    #[msg("Invalid oracle account provided")]
    InvalidOracle,
    #[msg("Invalid order index")]
    InvalidOrderIndex,
    #[msg("Order is not open")]
    OrderNotOpen,
    #[msg("Payout cannot be represented as an unsigned amount")]
    InvalidPayout,
}
