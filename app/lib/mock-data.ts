export const MOCK_TICKER = {
  pair: 'BTC-PERP',
  price: 65432.10,
  change24h: +2.4,
  fundingRate: 0.0100,
  openInterest: '120M',
  ohlc: { o: 65300, h: 65540, l: 65220, c: 65432 }
}

export const MOCK_ASKS = [
  { price: 65450.00, size: 0.450, total: 2140 },
  { price: 65445.50, size: 1.200, total: 1690 },
  { price: 65438.00, size: 0.050, total: 490 },
]

export const MOCK_BIDS = [
  { price: 65431.20, size: 0.820, total: 820 },
  { price: 65425.00, size: 2.140, total: 2960 },
  { price: 65410.00, size: 5.000, total: 7960 },
]

export const MOCK_POSITIONS = [
  {
    pair: 'BTC-PERP',
    side: 'Long',
    leverage: 10,
    size: '0.500 BTC',
    entryPrice: 64000.00,
    markPrice: 65432.10,
    liqPrice: 57600.00,
    pnl: +716.05,
    roi: +12.50,
  }
]

// ── Portfolio ──────────────────────────────────────────────
export const MOCK_PORTFOLIO = {
  totalValue: 24_831.42,
  totalPnl: +3_241.88,
  totalPnlPct: +15.03,
  availableMargin: 12_400.00,
  usedMargin: 12_431.42,
  unrealizedPnl: +716.05,
  dailyPnl: +284.22,
  weeklyPnl: +1_042.60,
  monthlyPnl: +3_241.88,
}

export const MOCK_PORTFOLIO_POSITIONS = [
  { pair: 'BTC-PERP', side: 'Long',  leverage: 10, size: 0.5,   value: 32_716, entryPrice: 64000, markPrice: 65432, pnl: +716.05,   roi: +12.50,  liqPrice: 57_600 },
  { pair: 'ETH-PERP', side: 'Long',  leverage: 5,  size: 3.2,   value:  9_840, entryPrice: 3020,  markPrice: 3076,  pnl: +179.20,   roi: +7.40,   liqPrice: 2_695 },
  { pair: 'SOL-PERP', side: 'Short', leverage: 3,  size: 120,   value: 16_920, entryPrice: 148,   markPrice: 141,   pnl: +840.00,   roi: +16.10,  liqPrice: 178 },
]

export const MOCK_PORTFOLIO_HISTORY = [
  { date: '2024-05-01', value: 20_200 },
  { date: '2024-05-05', value: 21_500 },
  { date: '2024-05-10', value: 20_800 },
  { date: '2024-05-15', value: 22_400 },
  { date: '2024-05-20', value: 23_100 },
  { date: '2024-05-25', value: 22_900 },
  { date: '2024-05-30', value: 24_831 },
]

// ── Stats / Analytics ─────────────────────────────────────
export const MOCK_STATS = {
  totalVolume: '2.84M',
  totalTrades: 438,
  winRate: 62.3,
  avgWin: +284.40,
  avgLoss: -142.20,
  profitFactor: 2.0,
  maxDrawdown: -8.4,
  sharpeRatio: 1.84,
  bestTrade: +1_840,
  worstTrade: -720,
  avgHoldTime: '4h 22m',
  totalFeesPaid: 312.44,
}

export const MOCK_MONTHLY_PNL = [
  { month: 'Dec', pnl: +420 },
  { month: 'Jan', pnl: -180 },
  { month: 'Feb', pnl: +860 },
  { month: 'Mar', pnl: +1_200 },
  { month: 'Apr', pnl: -340 },
  { month: 'May', pnl: +1_280 },
]

// ── Leaderboard ───────────────────────────────────────────
export const MOCK_LEADERBOARD = [
  { rank: 1,  address: '7xKp...mNvQ', volume: '18.4M', pnl: +84_200, winRate: 71.2, trades: 1_840, badge: 'Diamond' },
  { rank: 2,  address: 'C3Rq...wPzL', volume: '12.1M', pnl: +62_480, winRate: 68.4, trades: 1_280, badge: 'Diamond' },
  { rank: 3,  address: '9mFt...bNyK', volume: '9.8M',  pnl: +48_320, winRate: 65.8, trades: 980,   badge: 'Platinum' },
  { rank: 4,  address: 'BvQs...pXcJ', volume: '7.2M',  pnl: +38_900, winRate: 63.2, trades: 742,   badge: 'Platinum' },
  { rank: 5,  address: 'Hu4W...kRmA', volume: '5.6M',  pnl: +29_140, winRate: 61.0, trades: 621,   badge: 'Gold' },
  { rank: 6,  address: 'LpZd...eMcF', volume: '4.8M',  pnl: +24_830, winRate: 59.4, trades: 548,   badge: 'Gold' },
  { rank: 7,  address: 'Xr2N...vQtH', volume: '3.9M',  pnl: +19_640, winRate: 57.8, trades: 482,   badge: 'Silver' },
  { rank: 8,  address: 'Wy5K...nJbS', volume: '3.2M',  pnl: +15_280, winRate: 56.2, trades: 412,   badge: 'Silver' },
  { rank: 9,  address: 'Tz8M...dPwR', volume: '2.7M',  pnl: +12_400, winRate: 54.8, trades: 372,   badge: 'Bronze' },
  { rank: 10, address: 'Qk1V...hGxC', volume: '2.1M',  pnl: +9_820,  winRate: 53.4, trades: 318,   badge: 'Bronze' },
]

// ── Markets ───────────────────────────────────────────────
export const MOCK_MARKETS = [
  { pair: 'BTC-PERP', price: 65_432.10, change24h: +2.40, volume24h: '2.84B', openInterest: '1.2B', fundingRate: +0.0100, markPrice: 65_440, indexPrice: 65_430 },
  { pair: 'ETH-PERP', price: 3_076.40,  change24h: +1.82, volume24h: '1.12B', openInterest: '620M', fundingRate: +0.0082, markPrice: 3_077,  indexPrice: 3_075 },
  { pair: 'SOL-PERP', price: 141.20,    change24h: -0.94, volume24h: '342M',  openInterest: '184M', fundingRate: -0.0064, markPrice: 141.3,  indexPrice: 141.1 },
  { pair: 'BNB-PERP', price: 412.80,    change24h: +0.48, volume24h: '128M',  openInterest: '84M',  fundingRate: +0.0048, markPrice: 412.9,  indexPrice: 412.7 },
  { pair: 'ARB-PERP', price: 1.142,     change24h: +3.20, volume24h: '84M',   openInterest: '42M',  fundingRate: +0.0120, markPrice: 1.143,  indexPrice: 1.141 },
  { pair: 'OP-PERP',  price: 2.384,     change24h: -1.48, volume24h: '72M',   openInterest: '38M',  fundingRate: -0.0088, markPrice: 2.385,  indexPrice: 2.383 },
  { pair: 'AVAX-PERP',price: 28.42,     change24h: +1.14, volume24h: '64M',   openInterest: '32M',  fundingRate: +0.0060, markPrice: 28.43,  indexPrice: 28.41 },
  { pair: 'LINK-PERP', price: 14.82,    change24h: +0.82, volume24h: '48M',   openInterest: '24M',  fundingRate: +0.0044, markPrice: 14.83,  indexPrice: 14.81 },
  { pair: 'INJ-PERP', price: 24.10,     change24h: -2.30, volume24h: '38M',   openInterest: '18M',  fundingRate: -0.0100, markPrice: 24.11,  indexPrice: 24.09 },
  { pair: 'JTO-PERP', price: 3.82,      change24h: +4.10, volume24h: '28M',   openInterest: '12M',  fundingRate: +0.0180, markPrice: 3.83,   indexPrice: 3.81 },
]

// ── Trade History ─────────────────────────────────────────
export const MOCK_HISTORY = [
  { id: 'TX001', time: '2024-05-30 14:22', pair: 'BTC-PERP', side: 'Long',  size: '0.250 BTC', price: 65_200, fee: 16.30, pnl: +420.50,  status: 'Closed' },
  { id: 'TX002', time: '2024-05-30 11:08', pair: 'ETH-PERP', side: 'Short', size: '2.000 ETH', price: 3_120,  fee: 6.24,  pnl: +88.40,   status: 'Closed' },
  { id: 'TX003', time: '2024-05-29 22:14', pair: 'SOL-PERP', side: 'Long',  size: '80 SOL',    price: 148,    fee: 11.84, pnl: -210.40,  status: 'Closed' },
  { id: 'TX004', time: '2024-05-29 18:40', pair: 'BTC-PERP', side: 'Long',  size: '0.100 BTC', price: 64_800, fee: 6.48,  pnl: +168.20,  status: 'Closed' },
  { id: 'TX005', time: '2024-05-29 14:12', pair: 'ARB-PERP', side: 'Short', size: '500 ARB',   price: 1.164,  fee: 0.58,  pnl: -44.00,   status: 'Closed' },
  { id: 'TX006', time: '2024-05-28 20:30', pair: 'ETH-PERP', side: 'Long',  size: '1.500 ETH', price: 3_040,  fee: 4.56,  pnl: +216.00,  status: 'Closed' },
  { id: 'TX007', time: '2024-05-28 15:18', pair: 'BNB-PERP', side: 'Long',  size: '5.000 BNB', price: 408,    fee: 2.04,  pnl: +24.00,   status: 'Closed' },
  { id: 'TX008', time: '2024-05-27 09:44', pair: 'BTC-PERP', side: 'Short', size: '0.200 BTC', price: 65_800, fee: 13.16, pnl: +740.00,  status: 'Closed' },
  { id: 'TX009', time: '2024-05-26 17:22', pair: 'SOL-PERP', side: 'Short', size: '200 SOL',   price: 152,    fee: 30.40, pnl: -320.00,  status: 'Closed' },
  { id: 'TX010', time: '2024-05-26 08:10', pair: 'AVAX-PERP',side: 'Long',  size: '100 AVAX',  price: 27.80,  fee: 2.78,  pnl: +62.00,   status: 'Closed' },
]

// ── Account ───────────────────────────────────────────────
export const MOCK_ACCOUNT = {
  address: '7xKpMnVqBt3fR8sNwCzYdLpJhGxE2mKr',
  username: 'apex_trader',
  tier: 'Gold',
  joinDate: 'Jan 2024',
  totalVolume: '2.84M',
  totalTrades: 438,
  referrals: 12,
  totalFeesPaid: 312.44,
  feeDiscount: 20,
  nextTier: 'Platinum',
  nextTierVolume: '5M',
}

export const MOCK_ACCOUNT_BALANCES = [
  { asset: 'USDC', balance: 12_400.00, inOrders: 0,       total: 12_400.00,  usdValue: 12_400.00 },
  { asset: 'BTC',  balance: 0.012,     inOrders: 0,       total: 0.012,      usdValue: 785.18   },
  { asset: 'ETH',  balance: 0.250,     inOrders: 0,       total: 0.250,      usdValue: 769.10   },
  { asset: 'SOL',  balance: 8.400,     inOrders: 0,       total: 8.400,      usdValue: 1_186.08 },
]

// ── Rewards ───────────────────────────────────────────────
export const MOCK_REWARDS = {
  totalEarned: 1_842.40,
  pendingRewards: 284.20,
  nextEpochIn: '2d 14h',
  currentStreak: 7,
  maxStreak: 21,
  referralEarnings: 420.80,
  tradingRewards: 1_421.60,
  tier: 'Gold',
}

export const MOCK_REWARD_HISTORY = [
  { epoch: 'Epoch 24', period: 'May 20–27', trading: 142.40, referral: 48.00, total: 190.40, status: 'Claimable' },
  { epoch: 'Epoch 23', period: 'May 13–20', trading: 98.20,  referral: 36.00, total: 134.20, status: 'Claimed'   },
  { epoch: 'Epoch 22', period: 'May 6–13',  trading: 116.80, referral: 60.00, total: 176.80, status: 'Claimed'   },
  { epoch: 'Epoch 21', period: 'Apr 29–May 6', trading: 84.40, referral: 24.00, total: 108.40, status: 'Claimed' },
]

export const MOCK_DAILY_QUESTS = [
  { task: 'Place 3 trades',        reward: 10,  progress: 3,  target: 3,  done: true  },
  { task: 'Trade $10K+ volume',    reward: 20,  progress: 8,  target: 10, done: false },
  { task: 'Hold position 2h+',     reward: 15,  progress: 1,  target: 1,  done: true  },
  { task: 'Refer a friend',        reward: 50,  progress: 0,  target: 1,  done: false },
]
