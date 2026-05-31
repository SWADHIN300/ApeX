import { Pool } from "pg";

declare global {
  var apexPgPool: Pool | undefined;
  var apexDbReady: Promise<void> | undefined;
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

export async function ensureAuthSchema() {
  if (!globalThis.apexDbReady) {
    globalThis.apexDbReady = getPool().query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
    `).then(() => undefined);
  }

  return globalThis.apexDbReady;
}
