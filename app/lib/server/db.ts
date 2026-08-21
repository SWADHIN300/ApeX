import { Pool } from "pg";

declare global {
  var apexPgPool: Pool | undefined;
  var apexDbReady: Promise<void> | undefined;
}

export function isDatabaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return url;
}

export function getPool() {
  if (!globalThis.apexPgPool) {
    globalThis.apexPgPool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
  }

  return globalThis.apexPgPool;
}

export async function ensureSchema() {
  if (!isDatabaseConfigured()) return;

  if (!globalThis.apexDbReady) {
    globalThis.apexDbReady = getPool()
      .query(`
        CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
      `)
      .then(() => undefined);
  }

  return globalThis.apexDbReady;
}

export async function ensureAuthSchema() {
  return ensureSchema();
}
