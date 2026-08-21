CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users / Auth
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  wallet_address TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_wallet_idx ON users (wallet_address);

-- Trade Execution Records
CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('Long', 'Short')),
  size NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  fee NUMERIC NOT NULL DEFAULT 0,
  pnl NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Closed',
  tx_signature TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trades_user_address_idx ON trades (user_address);
CREATE INDEX IF NOT EXISTS trades_timestamp_idx ON trades (timestamp DESC);
CREATE INDEX IF NOT EXISTS trades_pair_idx ON trades (pair);

-- Order Book State / History
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  pair TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('Long', 'Short')),
  price NUMERIC NOT NULL,
  size NUMERIC NOT NULL,
  leverage SMALLINT NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('Open', 'Filled', 'Cancelled')),
  tx_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_user_address_idx ON orders (user_address);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

-- Leaderboard Aggregate Snapshot
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  address TEXT PRIMARY KEY,
  total_volume NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  pnl_pct NUMERIC NOT NULL DEFAULT 0,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  total_trades INT NOT NULL DEFAULT 0,
  rank INT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS leaderboard_pnl_idx ON leaderboard_cache (total_pnl DESC);
