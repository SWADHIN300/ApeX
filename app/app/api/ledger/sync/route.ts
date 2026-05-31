import { NextResponse } from "next/server";
import {
  clusterApiUrl,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { addDeposit, getLedgerBalance } from "@/lib/server/ledgerStore";
import type {
  LedgerAsset,
  LedgerDeposit,
  LedgerNetwork,
} from "@/lib/ledgerClient";
import type { ParsedInstruction, PartiallyDecodedInstruction } from "@solana/web3.js";

export const runtime = "nodejs";

type ParsedInstructionInfo = {
  source?: string;
  destination?: string;
  authority?: string;
  lamports?: number;
  mint?: string;
  tokenAmount?: {
    uiAmount?: number;
    uiAmountString?: string;
  };
};

function isNetwork(value: string | null): value is LedgerNetwork {
  return value === "devnet" || value === "mainnet-beta";
}

function isParsedInstruction(
  instruction: ParsedInstruction | PartiallyDecodedInstruction,
): instruction is ParsedInstruction {
  return "parsed" in instruction;
}

function getConnection(network: LedgerNetwork) {
  const endpoint =
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    clusterApiUrl(network);

  return new Connection(endpoint, "confirmed");
}

function checkSyncAuth(request: Request) {
  const syncSecret = process.env.LEDGER_SYNC_SECRET;
  if (!syncSecret) return true;

  return request.headers.get("authorization") === `Bearer ${syncSecret}`;
}

export async function POST(request: Request) {
  if (!checkSyncAuth(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const network = searchParams.get("network");
  const limit = Math.min(Number(searchParams.get("limit") ?? 25), 100);
  const treasuryAddress = process.env.NEXT_PUBLIC_APEX_TREASURY_WALLET;

  if (!isNetwork(network)) {
    return NextResponse.json({ error: "Invalid network." }, { status: 400 });
  }

  if (!treasuryAddress) {
    return NextResponse.json(
      { error: "Treasury wallet is not configured." },
      { status: 400 },
    );
  }

  const connection = getConnection(network);
  const treasury = new PublicKey(treasuryAddress);
  const signatures = await connection.getSignaturesForAddress(treasury, {
    limit,
  });
  const credited: LedgerDeposit[] = [];

  for (const item of signatures) {
    if (item.err) continue;

    const transaction = await connection.getParsedTransaction(item.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction || transaction.meta?.err) continue;

    const instructions = transaction.transaction.message.instructions.filter(
      isParsedInstruction,
    );

    for (const instruction of instructions) {
      if (instruction.program !== "system") continue;

      const info = instruction.parsed.info as ParsedInstructionInfo;
      if (
        instruction.parsed.type === "transfer" &&
        info.destination === treasuryAddress &&
        info.source &&
        typeof info.lamports === "number" &&
        info.lamports > 0
      ) {
        const deposit = await addDeposit({
          signature: item.signature,
          wallet: info.source,
          asset: "SOL",
          amount: info.lamports / LAMPORTS_PER_SOL,
          network,
          creditedAt: new Date(
            (transaction.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
          ).toISOString(),
        });
        credited.push(deposit);
      }
    }
  }

  const mintAddress = process.env.NEXT_PUBLIC_APEX_USDC_MINT;
  if (mintAddress) {
    const mint = new PublicKey(mintAddress);
    const treasuryTokenAccount = await getAssociatedTokenAddress(
      mint,
      treasury,
      true,
    );
    const tokenSignatures = await connection.getSignaturesForAddress(
      treasuryTokenAccount,
      { limit },
    );

    for (const item of tokenSignatures) {
      if (item.err) continue;

      const transaction = await connection.getParsedTransaction(item.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });

      if (!transaction || transaction.meta?.err) continue;

      const instructions = transaction.transaction.message.instructions.filter(
        isParsedInstruction,
      );

      for (const instruction of instructions) {
        if (instruction.program !== "spl-token") continue;

        const info = instruction.parsed.info as ParsedInstructionInfo;
        const tokenAmount = info.tokenAmount?.uiAmountString
          ? Number(info.tokenAmount.uiAmountString)
          : info.tokenAmount?.uiAmount;

        if (
          instruction.parsed.type === "transferChecked" &&
          info.destination === treasuryTokenAccount.toBase58() &&
          info.authority &&
          info.mint === mintAddress &&
          typeof tokenAmount === "number" &&
          tokenAmount > 0
        ) {
          const deposit = await addDeposit({
            signature: item.signature,
            wallet: info.authority,
            asset: "USDC" satisfies LedgerAsset,
            amount: tokenAmount,
            network,
            creditedAt: new Date(
              (transaction.blockTime ?? Math.floor(Date.now() / 1000)) * 1000,
            ).toISOString(),
          });
          credited.push(deposit);
        }
      }
    }
  }

  const uniqueWallets = [...new Set(credited.map((deposit) => deposit.wallet))];
  const balances = await Promise.all(
    uniqueWallets.map((wallet) => getLedgerBalance({ wallet, network })),
  );

  return NextResponse.json({
    credited,
    balances,
  });
}
