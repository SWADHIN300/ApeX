import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
} from "@solana/spl-token";
import type { SendTransactionOptions } from "@solana/wallet-adapter-base";

type SendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: SendTransactionOptions,
) => Promise<string>;

export const treasuryWalletAddress =
  process.env.NEXT_PUBLIC_APEX_TREASURY_WALLET ?? "";

export const usdcMintAddress = process.env.NEXT_PUBLIC_APEX_USDC_MINT ?? "";

export function hasTreasuryWallet() {
  return treasuryWalletAddress.trim().length > 0;
}

export function hasUsdcMint() {
  return usdcMintAddress.trim().length > 0;
}

export async function sendSolDeposit({
  amountSol,
  connection,
  publicKey,
  sendTransaction,
}: {
  amountSol: number;
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
}) {
  const treasury = new PublicKey(treasuryWalletAddress);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  if (lamports <= 0) {
    throw new Error("Enter a deposit amount greater than 0.");
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: publicKey,
      toPubkey: treasury,
      lamports,
    }),
  );

  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}

export async function sendUsdcDeposit({
  amountUsdc,
  connection,
  publicKey,
  sendTransaction,
}: {
  amountUsdc: number;
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
}) {
  const treasury = new PublicKey(treasuryWalletAddress);
  const mint = new PublicKey(usdcMintAddress);
  const mintInfo = await getMint(connection, mint);
  const multiplier = 10 ** mintInfo.decimals;
  const amount = BigInt(Math.round(amountUsdc * multiplier));

  if (amount <= BigInt(0)) {
    throw new Error("Enter a deposit amount greater than 0.");
  }

  const sourceTokenAccount = await getAssociatedTokenAddress(mint, publicKey);
  const destinationTokenAccount = await getAssociatedTokenAddress(
    mint,
    treasury,
    true,
  );

  const sourceAccount = await connection.getAccountInfo(sourceTokenAccount);
  if (!sourceAccount) {
    throw new Error("Your wallet does not have a USDC token account.");
  }

  const transaction = new Transaction();
  const destinationAccount = await connection.getAccountInfo(
    destinationTokenAccount,
  );

  if (!destinationAccount) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        publicKey,
        destinationTokenAccount,
        treasury,
        mint,
      ),
    );
  }

  transaction.add(
    createTransferCheckedInstruction(
      sourceTokenAccount,
      mint,
      destinationTokenAccount,
      publicKey,
      amount,
      mintInfo.decimals,
    ),
  );

  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}
