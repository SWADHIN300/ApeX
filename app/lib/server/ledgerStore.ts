import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  LedgerAsset,
  LedgerDeposit,
  LedgerNetwork,
} from "@/lib/ledgerClient";

type LedgerFile = {
  deposits: LedgerDeposit[];
};

const ledgerDir = path.join(process.cwd(), "..", ".ledger");
const ledgerPath = path.join(ledgerDir, "ledger.json");

async function readLedger(): Promise<LedgerFile> {
  try {
    const raw = await readFile(ledgerPath, "utf8");
    return JSON.parse(raw) as LedgerFile;
  } catch {
    return { deposits: [] };
  }
}

async function writeLedger(ledger: LedgerFile) {
  await mkdir(ledgerDir, { recursive: true });
  await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
}

export async function addDeposit(deposit: LedgerDeposit) {
  const ledger = await readLedger();
  const existing = ledger.deposits.find(
    (item) =>
      item.signature === deposit.signature && item.network === deposit.network,
  );

  if (existing) {
    return existing;
  }

  ledger.deposits.push(deposit);
  await writeLedger(ledger);

  return deposit;
}

export async function getLedgerBalance({
  wallet,
  network,
}: {
  wallet: string;
  network: LedgerNetwork;
}) {
  const ledger = await readLedger();
  const deposits = ledger.deposits
    .filter((deposit) => deposit.wallet === wallet && deposit.network === network)
    .sort((a, b) => b.creditedAt.localeCompare(a.creditedAt));
  const balances: Record<LedgerAsset, number> = {
    SOL: 0,
    USDC: 0,
  };

  for (const deposit of deposits) {
    balances[deposit.asset] += deposit.amount;
  }

  return {
    wallet,
    network,
    balances,
    deposits,
  };
}
