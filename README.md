# ApeX - Decentralized Perpetual Futures DEX

A cutting-edge decentralized exchange (DEX) platform built on Solana that enables users to trade perpetual futures contracts with advanced charting, real-time price feeds, and seamless wallet integration.

**Live Demo:** [https://app-six-liard-53.vercel.app/trade](https://app-six-liard-53.vercel.app/trade)

## 🚀 Overview

ApeX is a sophisticated perpetual futures trading platform leveraging Solana's blockchain technology for fast, low-cost transactions. The platform combines smart contracts written in Rust with an intuitive Next.js frontend, providing traders with professional-grade tools for derivatives trading.

### Key Features

- **Perpetual Futures Trading**: Trade derivatives contracts without expiration dates
- **Real-Time Price Feeds**: Integration with Pyth Network for accurate, tamper-proof price data
- **Advanced Charting**: Lightweight Charts for professional technical analysis
- **Multi-Asset Support**: Trade multiple assets through SPL tokens
- **Wallet Integration**: Seamless Solana wallet connectivity (Phantom, Ledger, etc.)
- **Dark Mode Support**: Modern UI with theme customization
- **Database Backend**: PostgreSQL for order history and trade data
- **Testnet Deployment**: Running on Solana Devnet for safe testing

## 📋 Project Structure

```
ApeX/
├── programs/                    # Solana smart contracts (Rust/Anchor)
│   ├── apex/                   # Core trading program
│   └── apex_protocol/          # Protocol logic and state management
├── app/                        # Next.js frontend application
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/             # Next.js pages (including /trade)
│   │   └── hooks/             # Custom React hooks
│   └── public/                 # Static assets
├── tests/                      # TypeScript test suite
├── Anchor.toml                 # Anchor framework configuration
├── Cargo.toml                  # Rust workspace configuration
├── package.json                # Node.js dependencies
└── tsconfig.json              # TypeScript configuration

```

## 🛠️ Tech Stack

### Smart Contracts (Blockchain Layer)
- **Anchor Framework**: `0.30.0` - Smart contract development framework for Solana
- **Rust**: High-performance language for blockchain programs
- **Solana Program Library (SPL)**: Token interactions
- **Pyth SDK**: Price feed integration for reliable oracle data

### Frontend (Web Layer)
- **Next.js**: `16.2.6` - React framework for production
- **React**: `19.2.4` - UI library
- **TypeScript**: Static typing for JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component library
  - React Slider for price/leverage inputs
  - React Tabs for interface navigation

### Solana Integration
- **@solana/web3.js**: `1.98.4` - Solana blockchain client
- **@solana/wallet-adapter**: Wallet connectivity and transaction signing
- **@solana/spl-token**: SPL token operations
- **@coral-xyz/anchor**: Client-side Anchor framework

### Data & Visualization
- **Lightweight Charts**: `5.2.0` - Professional charting library
- **PostgreSQL (pg)**: `8.21.0` - Database for historical data
- **Pyth Network Client**: Real-time price feeds
- **BN.js**: Big number arithmetic for precise calculations

### Development Tools
- **ESLint**: Code quality and linting
- **Prettier**: Code formatting
- **Mocha & Chai**: Testing framework for Rust contracts
- **ts-mocha**: TypeScript test runner

## 🔗 Smart Contract Details

### Deployed Programs (Solana Devnet)
- **ApeX Program**: `4X73X5YSS6zk6FBbjHKp9L4DGMMJfqKbvjkD6Q8Vf22e`
- **ApeX Protocol**: `E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s`

### Program Features
- **Order Management**: Create, modify, and execute perpetual futures orders
- **Position Tracking**: Track open positions, collateral, and P&L
- **Price Feed Integration**: Real-time price updates via Pyth Network
- **Settlement Logic**: Automatic order matching and settlement
- **Risk Management**: Liquidation and margin requirements

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm/yarn
- Solana CLI tools
- Rust and Anchor CLI installed
- A Solana wallet (Phantom, Ledger, etc.)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SWADHIN300/ApeX.git
   cd ApeX
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd app && npm install && cd ..
   ```

3. **Build smart contracts**
   ```bash
   anchor build
   ```

4. **Run tests**
   ```bash
   npm run test
   ```

### Development

**Start the frontend development server:**
```bash
cd app
npm run dev
```

The application will be available at `http://localhost:3000`

**Linting and formatting:**
```bash
npm run lint           # Check code style
npm run lint:fix       # Auto-fix formatting
```

## 🏗️ Architecture

### Smart Contract Architecture
The Solana programs follow a modular design:
- **Core Program (apex)**: Handles basic trading operations
- **Protocol Program (apex_protocol)**: Manages complex protocol logic and state

### Frontend Architecture
- **Pages**: `/trade` route for the main trading interface
- **Components**: Reusable React components for charts, orderbook, position management
- **Hooks**: Custom hooks for wallet connection and on-chain state management
- **Database**: PostgreSQL backend for caching orders and trade history

## 💱 Trading Features

### Perpetual Futures
- **No Expiration**: Hold positions indefinitely
- **Leverage Trading**: Trade with multiple collateral
- **Funding Rates**: Automatic mechanism to keep perpetual prices aligned with spot markets
- **Multi-Asset Support**: Trade various cryptocurrency pairs

### Risk Management
- **Liquidation Protection**: Automatic liquidation to prevent account bankruptcy
- **Margin Requirements**: Initial and maintenance margin validation
- **Position Limits**: Maximum position size constraints
- **Collateral Verification**: Real-time collateral sufficiency checks

### Charting & Analysis
- **Professional Charts**: Powered by Lightweight Charts
- **Multiple Timeframes**: 1m, 5m, 15m, 1h, 4h, 1d, 1w candles
- **Technical Indicators**: Support for common trading indicators
- **Real-time Updates**: Live price feed integration via Pyth Network

## 🔐 Security Considerations

- **Solana Devnet**: Currently deployed on testnet for safe development
- **Anchor Framework**: Built-in protections against common vulnerabilities
- **Pyth Network**: Tamper-proof price feeds reduce oracle manipulation risk
- **Wallet Integration**: Transactions require wallet signature authentication

## 📊 Database

PostgreSQL is used for:
- Order history and fills
- User trade statistics
- Position snapshots
- Price history caching

Configuration through environment variables or `pg` client connection strings.

## 🌐 Deployment

### Frontend (Vercel)
The frontend is deployed on Vercel at: https://app-six-liard-53.vercel.app/trade

**Deploy to Vercel:**
```bash
cd app
npm run build
# Deploy using Vercel CLI or GitHub integration
```

### Smart Contracts (Solana Devnet)
```bash
anchor deploy --provider.cluster devnet
```

## 📝 API & Integration

### Wallet Adapter
```typescript
// Connect wallet
const { connect, select, wallet } = useWallet();

// Send transaction
const signature = await sendTransaction(transaction, connection);
```

### Price Feeds
```typescript
// Get latest price from Pyth Network
const price = await pythClient.getPrice(priceId);
```

### Order Submission
```typescript
// Create and send order instruction
const tx = new Transaction();
tx.add(createOrderInstruction(...));
await sendTransaction(tx, connection);
```

## 🧪 Testing

Run the full test suite:
```bash
npm run test
```

Tests include:
- Smart contract unit tests
- Integration tests for protocol logic
- End-to-end trading scenarios
- Liquidation simulations

## 📚 Documentation

- **Anchor Framework**: https://www.anchor-lang.com/
- **Solana Developer Docs**: https://docs.solana.com/
- **Pyth Network**: https://pyth.network/
- **Next.js Docs**: https://nextjs.org/docs/

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request with clear descriptions

## 📄 License

This project is open source and available under the MIT License.

## 🐛 Reporting Issues

Found a bug? Please open an issue on GitHub with:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details

## 💬 Support & Community

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: General questions and community support

## 🗺️ Roadmap

- [ ] Mainnet deployment
- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Portfolio analytics dashboard
- [ ] Mobile app
- [ ] API for third-party integrations
- [ ] Governance token and DAO

## ⚠️ Disclaimer

ApeX is a decentralized trading platform. Trading perpetual futures involves significant risk including potential loss of principal. Users should:
- Understand perpetual futures mechanics before trading
- Start with testnet and small positions
- Never trade with funds they cannot afford to lose
- Use appropriate risk management tools

---

**Built with ❤️ on Solana**

For the latest updates, visit: https://app-six-liard-53.vercel.app/trade
