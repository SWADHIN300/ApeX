# ApeX Protocol — Security Audit Readiness & Pre-Audit Brief

> [!WARNING]
> **CRITICAL SECURITY DIRECTIVE**: ApeX holds user collateral in on-chain Solana vaults. Under no circumstances should this protocol be deployed to Solana Mainnet without a completed, remediated third-party security audit from a certified Solana security auditing firm.

---

## 1. Protocol Architecture & Scope

The scope of the audit includes all on-chain programs and instruction handlers in the workspace:

| Component | Path | Description |
|---|---|---|
| **Program Core** | `programs/apex_protocol/src/lib.rs` | Program declaration, Pyth price normalization, math helpers |
| **Constants** | `programs/apex_protocol/src/constants.rs` | Margin ratios, leverage limits, staleness thresholds |
| **Errors** | `programs/apex_protocol/src/errors.rs` | Custom error codes |
| **Events** | `programs/apex_protocol/src/events.rs` | Emitted protocol events |
| **State Definitions** | `programs/apex_protocol/src/state/` | `Market`, `OrderBook`, `Position`, `TraderMarginAccount`, `PendingPayout` |
| **Instruction Handlers** | `programs/apex_protocol/src/instructions/` | `initialize_market`, `deposit_margin`, `withdraw_margin`, `open_position`, `close_position`, `place_order`, `cancel_order`, `match_orders`, `liquidate`, `update_funding_rate`, `claim_pending_payout` |

---

## 2. Key Attack Surfaces & Risk Areas for Auditors

### A. Pyth Oracle Integration (`lib.rs:get_oracle_price`)
- **Staleness**: Checks `clock.unix_timestamp - publish_time <= 60s`.
- **Confidence Interval**: Validates `confidence <= (price * 100) / 10000` (max 1% confidence spread).
- **Exponent Scaling**: Normalizes arbitrary Pyth exponents (typically `-8` or `-6`) to 6 decimals (`1_000_000`).
- *Audit Focus*: Verify overflow safety with extreme exponents and zero-price/negative-price protection during network stalls or fast volatility.

### B. Order Matching & Collateral Accounting (`instructions/match_orders.rs`)
- Matches crossing orders without direct user signatures (signed by Keeper).
- Collateral is deducted proportionally from `TraderMarginAccount.locked_collateral`.
- *Audit Focus*: Ensure an adversary cannot craft non-profitable orders to drain or lock counterparty collateral, and verify that partial fill math leaves zero rounding dust.

### C. Dynamic Funding Rate Settlement (`instructions/update_funding_rate.rs`)
- Applies funding rate based on Open Interest imbalance (`OI_long - OI_short`), clamped to `MAX_FUNDING_RATE_BPS`.
- Iterates over `ctx.remaining_accounts` and updates `unrealized_pnl` directly.
- Each supplied account is verified to be the canonical `[b"position", market, owner]` PDA, de-duplicated within the call, and capped at `MAX_FUNDING_ACCOUNTS`.
- *Audit Focus*: Ensure that passing malicious or duplicate account infos in `remaining_accounts` cannot corrupt unrelated state or drain funds.

### D. Liquidation Flow (`instructions/liquidate.rs`)
- Triggered by keeper when mark price crosses `liquidation_price`.
- Values the position at the oracle mark: equity is floored at zero and capped at posted collateral, the keeper fee is drawn from that equity, any residual is credited back to the trader's margin account, forfeited collateral funds the liquidity pool, and shortfall beyond collateral is absorbed by the insurance fund as bad debt.
- *Audit Focus*: Verify CPI signer seeds (`market_signer_seeds`) and ensure healthy accounts cannot be liquidated prematurely due to rounding errors.

### E. Deferred Payout Recovery (`instructions/claim_pending_payout.rs`)
- `close_position` records a `PendingPayout` PDA when pool + insurance liquidity cannot cover a profitable close.
- `claim_pending_payout` lets the owner withdraw that balance as the pools refill, drawing from the liquidity pool first and then the insurance fund.
- *Audit Focus*: Confirm the pools are debited exactly once per unit of deferred payout (at claim time, not at close time) and that `pending_payouts_total` cannot desynchronize from the sum of individual PDAs.

---

## 3. Core Protocol Invariants

1. **Solvency Invariant**: `vault.amount >= SUM(margin_accounts.deposited_collateral) + market.insurance_fund + market.liquidity_pool`.
2. **Leverage Boundary Invariant**: Effective leverage MUST always satisfy `1 <= leverage <= 10`.
3. **Open Interest Parity**: For internal matching, `market.open_interest_long` and `market.open_interest_short` must increment/decrement in lockstep on fills.
4. **Order Book Integrity**: No order can be placed with `locked_collateral > deposited_collateral - existing_locked_collateral`.

---

## 4. Recommended Security Audit Firms

The following firms have deep specialization in Solana / Anchor smart contract audits:

1. **OtterSec** (https://osec.io) — Premier Solana audit firm (audited Serum, Saber, Marinade, Wormhole).
2. **Neodyme** (https://neodyme.io) — Specialized Solana security research and smart contract auditing.
3. **Halborn** (https://halborn.com) — Top-tier blockchain security and penetration testing.
4. **Trail of Bits** (https://www.trailofbits.com) — Rigorous formal verification and software assurance.
5. **CertiK / Zellic** — Comprehensive smart contract vulnerability assessment.

---

## 5. Auditor Instructions (Build & Test Reproducibility)

```bash
# 1. Install Solana CLI & Anchor 0.30.0
solana --version  # recommended: 1.18.x
anchor --version  # recommended: 0.30.0

# 2. Build smart contracts
anchor build

# 3. Run the automated integration test suite
npm install
anchor test
```
