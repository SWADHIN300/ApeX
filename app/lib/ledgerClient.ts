export type LedgerAsset = "SOL" | "USDC";
export type LedgerNetwork = "devnet" | "mainnet-beta";

export type LedgerDeposit = {
  signature: string;
  wallet: string;
  asset: LedgerAsset;
  amount: number;
  network: LedgerNetwork;
  creditedAt: string;
};

export type LedgerBalance = {
  wallet: string;
  network: LedgerNetwork;
  balances: Record<LedgerAsset, number>;
  deposits: LedgerDeposit[];
};

export async function fetchLedgerBalance({
  wallet,
  network,
}: {
  wallet: string;
  network: LedgerNetwork;
}) {
  const params = new URLSearchParams({ wallet, network });
  const response = await fetch(`/api/ledger/balance?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Unable to load ledger balance.");
  }

  return (await response.json()) as LedgerBalance;
}

export async function creditConfirmedDeposit({
  signature,
  wallet,
  asset,
  network,
}: {
  signature: string;
  wallet: string;
  asset: LedgerAsset;
  network: LedgerNetwork;
}) {
  const response = await fetch("/api/ledger/deposits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature, wallet, asset, network }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.error ?? "Unable to credit deposit.");
  }

  return body as { deposit: LedgerDeposit; balance: LedgerBalance };
}
