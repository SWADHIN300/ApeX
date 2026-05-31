import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import type { ParsedInstruction, PartiallyDecodedInstruction } from "@solana/web3.js";
import type { LedgerAsset, LedgerNetwork } from "@/lib/ledgerClient";
import { getServerSolanaRpcEndpoint } from "@/lib/solanaRpc";

type ParsedDeposit = {
  amount: number;
  slot: number;
};

type ParsedInstructionInfo = {
  destination?: string;
  source?: string;
  authority?: string;
  lamports?: number;
  mint?: string;
  tokenAmount?: {
    uiAmount?: number;
    uiAmountString?: string;
  };
};

function isParsedInstruction(
  instruction: ParsedInstruction | PartiallyDecodedInstruction,
): instruction is ParsedInstruction {
  return "parsed" in instruction;
}

function getConnection(network: LedgerNetwork) {
  return new Connection(getServerSolanaRpcEndpoint(network), "confirmed");
}

export async function verifyDepositTransaction({
  signature,
  wallet,
  asset,
  network,
}: {
  signature: string;
  wallet: string;
  asset: LedgerAsset;
  network: LedgerNetwork;
}): Promise<ParsedDeposit> {
  const treasuryAddress = process.env.NEXT_PUBLIC_APEX_TREASURY_WALLET;

  if (!treasuryAddress) {
    throw new Error("Treasury wallet is not configured.");
  }

  const connection = getConnection(network);
  const transaction = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!transaction) {
    throw new Error("Transaction was not found or is not confirmed yet.");
  }

  if (transaction.meta?.err) {
    throw new Error("Transaction failed on chain.");
  }

  const signer = transaction.transaction.message.accountKeys.find(
    (account) => account.signer && account.pubkey.toBase58() === wallet,
  );

  if (!signer) {
    throw new Error("Deposit transaction was not signed by this wallet.");
  }

  const instructions = transaction.transaction.message.instructions.filter(
    isParsedInstruction,
  );

  if (asset === "SOL") {
    for (const instruction of instructions) {
      if (instruction.program !== "system") continue;

      const info = instruction.parsed.info as ParsedInstructionInfo;
      if (
        instruction.parsed.type === "transfer" &&
        info.source === wallet &&
        info.destination === treasuryAddress &&
        typeof info.lamports === "number"
      ) {
        return {
          amount: info.lamports / LAMPORTS_PER_SOL,
          slot: transaction.slot,
        };
      }
    }
  }

  if (asset === "USDC") {
    const mintAddress = process.env.NEXT_PUBLIC_APEX_USDC_MINT;

    if (!mintAddress) {
      throw new Error("USDC mint is not configured.");
    }

    const mint = new PublicKey(mintAddress);
    const treasury = new PublicKey(treasuryAddress);
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mint,
      treasury,
      true,
    );
    const destination = destinationTokenAccount.toBase58();

    for (const instruction of instructions) {
      if (instruction.program !== "spl-token") continue;

      const info = instruction.parsed.info as ParsedInstructionInfo;
      const tokenAmount = info.tokenAmount?.uiAmountString
        ? Number(info.tokenAmount.uiAmountString)
        : info.tokenAmount?.uiAmount;

      if (
        instruction.parsed.type === "transferChecked" &&
        info.authority === wallet &&
        info.destination === destination &&
        info.mint === mintAddress &&
        typeof tokenAmount === "number" &&
        tokenAmount > 0
      ) {
        return {
          amount: tokenAmount,
          slot: transaction.slot,
        };
      }
    }
  }

  throw new Error("Transaction does not match a valid treasury deposit.");
}
