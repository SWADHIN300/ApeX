# ApeX - Decentralized Perpetual Futures DEX

A high-performance perpetual futures decentralized exchange (DEX) built on Solana, featuring on-chain order matching, Pyth Network oracle risk management, autonomous keeper operations, and real-time charting.

**Live Demo:** [https://app-six-liard-53.vercel.app/trade](https://app-six-liard-53.vercel.app/trade)

---

## ⚡ System Status & Known Limitations

> [!IMPORTANT]
> ApeX is currently running on **Solana Devnet** for testing and technical validation. It has not undergone a formal third-party audit. Do not deposit mainnet assets.

- **Oracle & Mark Price**: Settlement, collateral validation, and liquidations rely on on-chain Pyth Network price feeds (`get_oracle_price`). Interactive Candlestick charts display high-frequency reference feed data (Binance, Coinbase, Kraken).
- **Autonomous Keepers**: Order matching (`match_orders`), liquidation execution (`liquidate`), and 8-hour funding rate settlements (`update_funding_rate`) are processed by the autonomous Keeper cron service located in `/keeper`.
- **On-Chain Positions**: Open positions are mapped directly to on-chain `Position` PDAs `[b"position", market, trader]`.
- **Data Persistence**: Trade execution history, order management, and leaderboard rankings are cached and queried via a PostgreSQL pipeline.

---

## 📋 Project Structure

```
ApeX/
├── programs/
│   └── apex_protocol/         # Core Anchor smart contract (Perp DEX protocol)
│       └── src/
│           ├── instructions/  # Handlers: match_orders, liquidate, open/close, etc.
│           ├── state/         # Account structs: Market, OrderBook, Position, Margin
│           ├── constants.rs   # Leverage boundaries, margin rates, staleness
│           ├── errors.rs      # Custom error codes
│           └── lib.rs         # Entrypoint & Pyth price account parser
├── app/                       # Next.js 16 Web Application (App Router)
│   ├── app/                   # App Router pages (/trade, /portfolio, /stats, /leaderboard)
│   ├── components/            # React UI components (OrderForm, PositionPanel, ChartPanel)
│   ├── contexts/              # Trade, Market, Wallet, and Settings React contexts
│   ├── hooks/                 # Custom React hooks (useOracle, usePositions, useOrderBook)
│   ├── lib/                   # On-chain PDA decoders, RPC client, types, constants
│   └── db/                    # PostgreSQL schema definition
├── keeper/                    # Autonomous keeper service (Node.js/TypeScript)
│   ├── keeper.ts              # Engine for matching, liquidations, and funding rates
│   └── package.json           # Keeper service dependencies
├── tests/                     # Mocha/Chai on-chain integration test suite
│   └── apex_protocol.ts       # Comprehensive protocol unit & integration tests
├── .github/workflows/         # CI/CD workflows
│   └── keeper-cron.yml        # Periodic GitHub Actions keeper runner
├── Anchor.toml                # Anchor configuration
├── Cargo.toml                 # Rust workspace configuration
└── package.json               # Workspace root configuration
```

---

## 🛠️ Tech Stack

### Smart Contracts (Solana Layer)
- **Anchor Framework**: `0.30.0`
- **Rust**: Solana on-chain runtime
- **Pyth Network**: On-chain price oracle verification & confidence bounds
- **SPL Token**: Multi-asset collateral management

### Autonomous Keeper Service
- **TypeScript & @solana/web3.js**: High-frequency orderbook monitoring
- **GitHub Actions Cron**: Scheduled execution (`*/5 * * * *`)

### Frontend Application
- **Next.js**: `16.2.6` (App Router)
- **React**: `19.2.4`
- **Trading Chart**: Lightweight Charts (`5.2.0`)
- **Solana Wallet Adapter**: Phantom, Solflare, Ledger connectivity
- **PostgreSQL**: Trade history, order tracking, and leaderboard analytics

---

## 🔗 Smart Contract Deployment (Solana Devnet)

- **ApeX Protocol Program ID**: `E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s`
- **Cluster**: `devnet`
- **Base Collateral Mint**: Devnet USDC (`4zMMC9srt5Ri5X14GVnYj7wAVTJGN1YjBe5HL4s3bQDa`)

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js 18+ and npm
- Rust & Solana CLI tools (optional, for smart contract development)
- Anchor CLI `0.30.0`

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/SWADHIN300/ApeX.git
cd ApeX

# Install root dependencies
npm install

# Install frontend dependencies
cd app && npm install && cd ..
```

### 3. Running the Frontend
```bash
npm run dev
# or: cd app && npm run dev
```
Access the application at `http://localhost:3000`.

### 4. Running the Keeper Service
```bash
cd keeper
npm install
npm start
```

### 5. Running the Test Suite
```bash
anchor test
# or: npm run test
```

---

## 🧪 Test Suite Coverage

The protocol test suite (`tests/apex_protocol.ts`) covers:
- **Market & OrderBook Initialization**: Verified PDA creation, authority checks, and fee validation.
- **Trader Margin Accounts**: Collateral deposits, withdrawals, and locked margin bounds.
- **Leverage Boundary Validation**: Strict enforcement of `1x <= leverage <= 10x`, rejection of out-of-bounds orders.
- **Order Matching & Settlement**: Crossing bid/ask execution, proportional locked collateral consumption, and on-chain `Position` PDA generation.
- **Liquidation Risk Engine**: Threshold evaluation against oracle mark price, rejection of healthy positions.
- **Funding Rate Settlement**: 8-hour interval enforcement (`FundingTooEarly`), open interest imbalance calculation.

---

## 🔐 Security & Audit Status

See [AUDIT.md](./AUDIT.md) for detailed security specifications, protocol invariants, and instructions for third-party security auditors.

---

## 📄 License

This project is open-source under the MIT License.
