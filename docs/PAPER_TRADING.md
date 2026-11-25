# Paper Trading in Devnet Mode

ApeX features a full-featured **Paper Trading Mode** on Solana Devnet. This allows anyone—presenters, evaluators, developers, and users—to test-drive the entire perpetual futures trading terminal and demonstrate the trading flow without needing real funds, devnet faucet tokens, or wallet transaction signatures.

---

## 🌟 Key Highlights

- **Zero Risk & Zero Cost**: No mainnet funds, devnet USDC, or SOL transactions are signed, broadcast, or sent.
- **Wallet-Linked Recovery**: Connect and sign a one-time login message to save or restore the same practice account across browsers and devices. No paper order requires a transaction signature.
- **Devnet Guarded**: Paper trading is strictly restricted to Devnet mode. If switched to Mainnet, paper trading automatically disengages to prevent confusion with real trades.
- **Realistic Perpetual Trading Flow**:
  - $10,000 virtual USDC starting balance
  - Instant simulated fills at live mark prices
  - Leverage selector (1x to 10x) with liquidation price calculation
  - Dynamic unrealized PnL and ROI% updated in real-time as market prices move
  - Position closing with fee deduction and margin return
  - Complete trade history and portfolio breakdown
- **Visual Separation**: Paper trading is prominently distinguished across the interface:
  - Sidebar Account Card showing current virtual balance ($10,000.00 USDC) & `Reset Account` button
  - Account Settings (`/accounts`) mode switcher between Live Devnet Wallet & Paper Trading
  - Amber `PAPER` badge on order button (`📝 Paper Long` / `📝 Paper Short`)
  - `PAPER` indicator pill on positions in the Position table
  - `SIM` badge on simulated trades in History and Portfolio
  - Status indicator in the stats bar showing `Devnet (Paper)`

---

## 🚀 How to Run the Demo

### 1. Launch the Application
```bash
npm run dev
# or
cd app && npm run dev
```
Open [http://localhost:3000](http://localhost:3000) (routes to `/trade`).

### 2. Verify / Switch to Devnet
In the top right corner of the TopBar:
- Check the network badge. If it shows `Mainnet`, click it once to toggle to `devnet`.
- Notice the network status in the stats bar updates to `Devnet`.

### 3. Enable Paper Trading or Use Devnet Wallet
Connect a Solana wallet first. Paper accounts are tied to the connected wallet so the server can restore the same balance, positions, and history on another device.

There are two ways to start or restore Paper Trading:
- **Sidebar Mode Switcher**: In the left sidebar (`SideNav`), switch between `Wallet` and `Paper`. The first time, approve a wallet sign-in message and claim the virtual practice balance.
  - When in `Paper`: Displays `Paper Trading Mode (Devnet) — Virtual Balance: $10,000.00 USDC` and `Reset Account`.
  - When in `Wallet`: Displays your connected Devnet wallet SOL balance and protocol margin.
- **Account Settings (`/accounts`)**: Visit `/accounts` to switch modes, request a 1-SOL devnet airdrop, or reset the paper balance.

The wallet signature only proves account ownership. It does not authorize or submit a token transfer. The first start credits $10,000 in virtual USDC; returning wallets restore their saved account.

Once enabled:
- The sidebar reflects: `Paper Trading Mode (Devnet) — Virtual Balance: $10,000.00 USDC`.
- The Order Form buttons change to `📝 Paper Long` and `📝 Paper Short`.
- The wallet connect requirement is lifted for simulated trades.

### 4. Place a Simulated Trade
1. Select a market (e.g. `BTC-PERP` or `SOL-PERP`).
2. Choose **Long** or **Short**.
3. Pick your leverage (e.g., `5x` or `10x`).
4. Enter an order size in USDC (or click `25%`, `50%`, `75%`, `100%` quick buttons).
5. Click **📝 Paper Long** / **📝 Paper Short**.
6. Notice the instant confirmation notification: `Paper Order Filled (Simulated)`.

### 5. Inspect Open Positions and Live PnL
1. In the bottom **Positions** panel, see your new position.
2. Note the entry price, mark price, liquidation price, and `PAPER` tag.
3. As live market ticker data arrives, watch your PnL ($) and ROI (%) tick in real-time.

### 6. Close the Position & Check History
1. Click the **Close** button on the position row.
2. The position closes immediately:
   - Margin is released back to your virtual available balance.
   - Realized profit/loss is credited/debited.
   - Estimated 0.04% trading fee is deducted.
3. Switch to the **History** tab in the Position Panel or navigate to `/history` to see the closed trade with its `SIM` badge, executed price, fee, and net PnL.

### 7. View Portfolio Breakdown
Navigate to `/portfolio`:
- Shows **Virtual Total Value**, **Available Margin**, **Used Margin**, and **Unrealized / Realized PnL**.
- Margin breakdown charts and recent activity reflect paper trading data.

### 8. Resetting Paper Balance
To reset the demo back to the clean $10,000 initial balance:
- Click **Reset Account** in the amber top banner, OR
- Click **Reset Virtual Balance** on the `/portfolio` page, OR
- Click **Reset to $10,000** in `/settings` under the Trading tab.

---

## 🏗️ Architecture & Implementation Details

```
app/
├── contexts/
│   ├── PaperTradingContext.tsx   # Core paper trading engine (state, persistence, math)
│   ├── TradeContext.tsx          # Real protocol trading context (on-chain Anchor)
│   └── WalletProvider.tsx        # Network provider (devnet / mainnet gate)
├── hooks/
│   └── usePositions.ts           # Unified hook resolving active (paper or real) positions
├── components/
│   ├── OrderForm.tsx             # Simulated order placement & paper form styling
│   ├── PositionPanel.tsx         # Positions table with PAPER tags & instant closing
│   ├── TopBar.tsx                # 1-click toggle button & persistent amber banner
│   ├── StatsBar.tsx              # Live Devnet (Paper) network indicator
│   └── layout/AppShell.tsx       # Dynamic layout adjusting for paper banner
└── app/
    ├── portfolio/page.tsx        # Virtual portfolio analytics and reset action
    ├── history/page.tsx          # Trade logs with SIM tags & CSV export
    └── settings/page.tsx         # Settings toggle and demo balance management
```

### State Storage
Paper trading accounts are stored in PostgreSQL, keyed by the wallet address after a signed challenge. The server stores the virtual balance, open positions, and trade history; the browser stores only the paper-mode preference. Any paper account already saved by the previous browser-only version is imported the first time its wallet claims an account. Set `DATABASE_URL` and `AUTH_SECRET` for API-backed accounts and sessions.

The sign-in challenge expires after five minutes and can be used once. The wallet signature only establishes account ownership; it does not authorize token transfers. Paper data remains separate from on-chain protocol state.
