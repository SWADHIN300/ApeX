import type { SendTransactionOptions } from "@solana/wallet-adapter-base";
import {
  Connection,
  type AccountInfo,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, getMint, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { OrderBookLevel } from "./types";
import {
  DEFAULT_FEE_RATE_BPS,
  ORDER_SIZE_BYTES,
  PRICE_DECIMALS,
  SIZE_DECIMALS,
} from "./constants";

type SendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: SendTransactionOptions,
) => Promise<string>;

type PlaceProtocolOrderParams = {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  pair: string;
  side: "Long" | "Short";
  price: number;
  sizeUsdc: number;
  leverage: number;
};

const DEFAULT_APEX_PROTOCOL_PROGRAM_ID =
  "D643vETCKW14hgvpmUoWZTYi65R9tijNm1RGmZFfS6g1";
const PLACE_ORDER_DISCRIMINATOR = Buffer.from([
  51, 194, 155, 175, 109, 130, 96, 106,
]);
const INITIALIZE_MARKET_DISCRIMINATOR = Buffer.from([
  35, 35, 189, 193, 155, 48, 170, 203,
]);
const DEPOSIT_MARGIN_DISCRIMINATOR = Buffer.from([
  240, 96, 57, 37, 173, 174, 158, 219,
]);
const WITHDRAW_MARGIN_DISCRIMINATOR = Buffer.from([
  124, 222, 8, 141, 181, 108, 15, 176,
]);
const CLAIM_PENDING_PAYOUT_DISCRIMINATOR = Buffer.from([
  193, 0, 88, 10, 7, 129, 141, 108,
]);

export function getApexProtocolProgramId() {
  return new PublicKey(
    process.env.NEXT_PUBLIC_APEX_PROTOCOL_PROGRAM_ID ||
      DEFAULT_APEX_PROTOCOL_PROGRAM_ID,
  );
}

function getConfiguredMarketMints() {
  const raw = process.env.NEXT_PUBLIC_APEX_MARKET_MINTS;
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getMarketBaseMint(pair: string, network?: "devnet" | "mainnet-beta") {
  const mintMap = getConfiguredMarketMints();
  const mappedMint = mintMap[pair];

  if (mappedMint) return new PublicKey(mappedMint);

  // If on devnet, prefer the devnet-specific mint
  const isDevnet =
    network === "devnet" ||
    (typeof window !== "undefined" &&
      localStorage.getItem("apex-network") === "devnet");

  if (isDevnet) {
    const devnetMint =
      process.env.NEXT_PUBLIC_APEX_DEVNET_BASE_MINT ||
      process.env.NEXT_PUBLIC_APEX_DEVNET_USDC_MINT;
    if (devnetMint) return new PublicKey(devnetMint);
  }

  const fallbackMint = process.env.NEXT_PUBLIC_APEX_BASE_MINT;
  if (fallbackMint) return new PublicKey(fallbackMint);

  throw new Error(
    "Set NEXT_PUBLIC_APEX_MARKET_MINTS or NEXT_PUBLIC_APEX_BASE_MINT before placing on-chain orders.",
  );
}

export function getMarketPdas(pair: string) {
  const programId = getApexProtocolProgramId();
  const baseMint = getMarketBaseMint(pair);
  const [market] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), baseMint.toBuffer()],
    programId,
  );
  const [orderBook] = PublicKey.findProgramAddressSync(
    [Buffer.from("orderbook"), market.toBuffer()],
    programId,
  );

  return { programId, baseMint, market, orderBook };
}

export function getTraderMarginPda(market: PublicKey, owner: PublicKey) {
  const programId = getApexProtocolProgramId();
  const [marginAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from("margin"), market.toBuffer(), owner.toBuffer()],
    programId,
  );

  return marginAccount;
}

function readMarketVault(data: Buffer) {
  const vaultOffset = 8 + 32 + 32;
  return new PublicKey(data.subarray(vaultOffset, vaultOffset + 32));
}

function readProtocolOrder(data: Buffer, offset: number) {
  const side = data.readUInt8(offset + 32);
  const price = Number(readU64LE(data, offset + 33)) / PRICE_DECIMALS;
  const size = Number(readU64LE(data, offset + 41)) / SIZE_DECIMALS;
  const lockedCollateral =
    Number(readU64LE(data, offset + 49)) / SIZE_DECIMALS;
  const leverage = data.readUInt8(offset + 57);
  const status = data.readUInt8(offset + 58);
  const createdAt = Number(readI64LE(data, offset + 59));

  return { side, price, size, lockedCollateral, leverage, status, createdAt };
}

function aggregateLevels(levels: OrderBookLevel[]): OrderBookLevel[] {
  const map = new Map<number, number>();
  for (const lvl of levels) {
    map.set(lvl.price, (map.get(lvl.price) || 0) + lvl.size);
  }
  return Array.from(map.entries()).map(([price, size]) => ({ price, size }));
}

export function decodeProtocolOrderBook(data: Buffer) {
  if (data.length < 8 + 32 + 4) {
    return { bids: [], asks: [] };
  }

  let offset = 8 + 32;
  const asksLength = data.readUInt32LE(offset);
  offset += 4;

  const rawAsks: OrderBookLevel[] = [];
  for (let index = 0; index < asksLength; index += 1) {
    if (offset + ORDER_SIZE_BYTES > data.length) break;
    const order = readProtocolOrder(data, offset);
    if (order.status === 0 && order.price > 0 && order.size > 0) {
      rawAsks.push({ price: order.price, size: order.size });
    }
    offset += ORDER_SIZE_BYTES;
  }

  if (offset + 4 > data.length) {
    return {
      bids: [],
      asks: aggregateLevels(rawAsks).sort((a, b) => a.price - b.price),
    };
  }

  const bidsLength = data.readUInt32LE(offset);
  offset += 4;

  const rawBids: OrderBookLevel[] = [];
  for (let index = 0; index < bidsLength; index += 1) {
    if (offset + ORDER_SIZE_BYTES > data.length) break;
    const order = readProtocolOrder(data, offset);
    if (order.status === 0 && order.price > 0 && order.size > 0) {
      rawBids.push({ price: order.price, size: order.size });
    }
    offset += ORDER_SIZE_BYTES;
  }

  const asks = aggregateLevels(rawAsks).sort((a, b) => a.price - b.price);
  const bids = aggregateLevels(rawBids).sort((a, b) => b.price - a.price);

  return { bids, asks };
}

export async function fetchProtocolOrderBook(connection: Connection, pair: string) {
  const { orderBook } = getMarketPdas(pair);
  const account = await connection.getAccountInfo(orderBook);

  if (!account) {
    return { bids: [], asks: [] };
  }

  return decodeProtocolOrderBook(account.data);
}

export function subscribeProtocolOrderBook(
  connection: Connection,
  pair: string,
  callback: (data: { bids: OrderBookLevel[]; asks: OrderBookLevel[] }) => void,
) {
  const { orderBook } = getMarketPdas(pair);
  const listenerId = connection.onAccountChange(
    orderBook,
    (account: AccountInfo<Buffer>) => {
      callback(decodeProtocolOrderBook(account.data));
    },
    "confirmed",
  );

  return () => {
    void connection.removeAccountChangeListener(listenerId);
  };
}

export type ProtocolMarginAccount = {
  depositedCollateral: number;
  lockedCollateral: number;
  availableCollateral: number;
};

export function decodeProtocolMarginAccount(data: Buffer): ProtocolMarginAccount {
  const depositedCollateral = Number(readU64LE(data, 8 + 32 + 32)) / SIZE_DECIMALS;
  const lockedCollateral = Number(readU64LE(data, 8 + 32 + 32 + 8)) / SIZE_DECIMALS;

  return {
    depositedCollateral,
    lockedCollateral,
    availableCollateral: Math.max(0, depositedCollateral - lockedCollateral),
  };
}

export async function fetchProtocolMarginAccount(
  connection: Connection,
  pair: string,
  owner: PublicKey,
): Promise<ProtocolMarginAccount> {
  const { market } = getMarketPdas(pair);
  const marginAccount = getTraderMarginPda(market, owner);
  const account = await connection.getAccountInfo(marginAccount);

  if (!account) {
    return { depositedCollateral: 0, lockedCollateral: 0, availableCollateral: 0 };
  }

  return decodeProtocolMarginAccount(account.data);
}

export function subscribeProtocolMarginAccount(
  connection: Connection,
  pair: string,
  owner: PublicKey,
  callback: (data: ProtocolMarginAccount) => void,
) {
  const { market } = getMarketPdas(pair);
  const marginAccount = getTraderMarginPda(market, owner);
  const listenerId = connection.onAccountChange(
    marginAccount,
    (account: AccountInfo<Buffer>) => {
      callback(decodeProtocolMarginAccount(account.data));
    },
    "confirmed",
  );

  return () => {
    void connection.removeAccountChangeListener(listenerId);
  };
}
function writeU64LE(buffer: Buffer, value: bigint, offset: number) {
  if (typeof buffer.writeBigUInt64LE === 'function') {
    buffer.writeBigUInt64LE(value, offset);
  } else {
    const low = Number(value & BigInt(0xffffffff));
    const high = Number((value >> BigInt(32)) & BigInt(0xffffffff));
    buffer.writeUInt32LE(low, offset);
    buffer.writeUInt32LE(high, offset + 4);
  }
}

function readU64LE(buffer: Buffer, offset: number): bigint {
  if (typeof buffer.readBigUInt64LE === 'function') {
    return buffer.readBigUInt64LE(offset);
  }
  const low = BigInt(buffer.readUInt32LE(offset));
  const high = BigInt(buffer.readUInt32LE(offset + 4));
  return (high << BigInt(32)) | low;
}

function readI64LE(buffer: Buffer, offset: number): bigint {
  if (typeof buffer.readBigInt64LE === 'function') {
    return buffer.readBigInt64LE(offset);
  }
  const low = BigInt(buffer.readUInt32LE(offset));
  const high = BigInt(buffer.readInt32LE(offset + 4));
  return (high << BigInt(32)) | low;
}

function toProtocolAmount(value: number, decimals: number) {
  return BigInt(Math.round(value * decimals));
}

function createInitializeMarketInstruction({
  programId,
  authority,
  market,
  orderBook,
  baseMint,
  vault,
}: {
  programId: PublicKey;
  authority: PublicKey;
  market: PublicKey;
  orderBook: PublicKey;
  baseMint: PublicKey;
  vault: PublicKey;
}) {
  // Never auto-create a market with a non-oracle default: an unset/SystemProgram
  // "oracle" makes every open/close/liquidate revert and, because the PDA is
  // keyed by base mint, a wrong-signer init can also lock out the real deployer.
  const oracleEnv = process.env.NEXT_PUBLIC_APEX_ORACLE;
  if (!oracleEnv) {
    throw new Error(
      "NEXT_PUBLIC_APEX_ORACLE is not configured. A Pyth oracle address is required " +
        "to initialize a market and to place orders.",
    );
  }
  const oracle = new PublicKey(oracleEnv);
  const data = Buffer.alloc(48);
  INITIALIZE_MARKET_DISCRIMINATOR.copy(data, 0);
  writeU64LE(data, BigInt(DEFAULT_FEE_RATE_BPS), 8);
  oracle.toBuffer().copy(data, 16);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: true, isWritable: true },
      { pubkey: baseMint, isSigner: false, isWritable: false },
      { pubkey: orderBook, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createPlaceOrderInstruction({
  programId,
  signer,
  market,
  orderBook,
  marginAccount,
  vault,
  traderTokenAccount,
  side,
  price,
  sizeUsdc,
  leverage,
}: {
  programId: PublicKey;
  signer: PublicKey;
  market: PublicKey;
  orderBook: PublicKey;
  marginAccount: PublicKey;
  vault: PublicKey;
  traderTokenAccount: PublicKey;
  side: "Long" | "Short";
  price: number;
  sizeUsdc: number;
  leverage: number;
}) {
  const data = Buffer.alloc(26);
  PLACE_ORDER_DISCRIMINATOR.copy(data, 0);
  data.writeUInt8(side === "Long" ? 0 : 1, 8);
  writeU64LE(data, toProtocolAmount(price, PRICE_DECIMALS), 9);
  writeU64LE(data, toProtocolAmount(sizeUsdc, SIZE_DECIMALS), 17);
  data.writeUInt8(leverage, 25);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: signer, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: orderBook, isSigner: false, isWritable: true },
      { pubkey: marginAccount, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: traderTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createDepositMarginInstruction({
  programId,
  trader,
  market,
  marginAccount,
  vault,
  traderTokenAccount,
  amount,
}: {
  programId: PublicKey;
  trader: PublicKey;
  market: PublicKey;
  marginAccount: PublicKey;
  vault: PublicKey;
  traderTokenAccount: PublicKey;
  amount: bigint;
}) {
  const data = Buffer.alloc(16);
  DEPOSIT_MARGIN_DISCRIMINATOR.copy(data, 0);
  writeU64LE(data, amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: trader, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: marginAccount, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: traderTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

function createWithdrawMarginInstruction({
  programId,
  trader,
  market,
  marginAccount,
  vault,
  traderTokenAccount,
  amount,
}: {
  programId: PublicKey;
  trader: PublicKey;
  market: PublicKey;
  marginAccount: PublicKey;
  vault: PublicKey;
  traderTokenAccount: PublicKey;
  amount: bigint;
}) {
  const data = Buffer.alloc(16);
  WITHDRAW_MARGIN_DISCRIMINATOR.copy(data, 0);
  writeU64LE(data, amount, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: trader, isSigner: true, isWritable: true },
      { pubkey: market, isSigner: false, isWritable: true },
      { pubkey: marginAccount, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: traderTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

async function getMarketVaultForTransaction({
  connection,
  publicKey,
  pair,
  transaction,
  signers,
}: {
  connection: Connection;
  publicKey: PublicKey;
  pair: string;
  transaction: Transaction;
  signers: Keypair[];
}) {
  const { programId, baseMint, market, orderBook } = getMarketPdas(pair);
  const marketAccount = await connection.getAccountInfo(market);
  const orderBookAccount = await connection.getAccountInfo(orderBook);

  if (!marketAccount || !orderBookAccount) {
    const vaultKeypair = Keypair.generate();
    signers.push(vaultKeypair);
    transaction.add(
      createInitializeMarketInstruction({
        programId,
        authority: publicKey,
        market,
        orderBook,
        baseMint,
        vault: vaultKeypair.publicKey,
      }),
    );
    return { programId, baseMint, market, orderBook, vault: vaultKeypair.publicKey };
  }

  return { programId, baseMint, market, orderBook, vault: readMarketVault(marketAccount.data) };
}

async function toTokenAmount(connection: Connection, mint: PublicKey, amount: number) {
  const mintInfo = await getMint(connection, mint);
  const multiplier = 10 ** mintInfo.decimals;
  const rawAmount = BigInt(Math.round(amount * multiplier));

  if (rawAmount <= BigInt(0)) {
    throw new Error("Enter an amount greater than 0.");
  }

  return rawAmount;
}

export async function depositProtocolMargin({
  connection,
  publicKey,
  sendTransaction,
  pair,
  amount,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  pair: string;
  amount: number;
}) {
  const transaction = new Transaction();
  const signers: Keypair[] = [];
  const { programId, baseMint, market, vault } = await getMarketVaultForTransaction({
    connection,
    publicKey,
    pair,
    transaction,
    signers,
  });
  const traderTokenAccount = await getAssociatedTokenAddress(baseMint, publicKey);
  const sourceAccount = await connection.getAccountInfo(traderTokenAccount);

  if (!sourceAccount) {
    throw new Error("Your wallet does not have a collateral token account for this market.");
  }

  const marginAccount = getTraderMarginPda(market, publicKey);
  const rawAmount = await toTokenAmount(connection, baseMint, amount);

  transaction.add(
    createDepositMarginInstruction({
      programId,
      trader: publicKey,
      market,
      marginAccount,
      vault,
      traderTokenAccount,
      amount: rawAmount,
    }),
  );

  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
    signers,
  });

  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function withdrawProtocolMargin({
  connection,
  publicKey,
  sendTransaction,
  pair,
  amount,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  pair: string;
  amount: number;
}) {
  const transaction = new Transaction();
  const signers: Keypair[] = [];
  const { programId, baseMint, market, vault } = await getMarketVaultForTransaction({
    connection,
    publicKey,
    pair,
    transaction,
    signers,
  });
  const traderTokenAccount = await getAssociatedTokenAddress(baseMint, publicKey);
  const tokenAccount = await connection.getAccountInfo(traderTokenAccount);

  if (!tokenAccount) {
    throw new Error("Your wallet does not have a collateral token account for this market.");
  }

  const marginAccount = getTraderMarginPda(market, publicKey);
  const rawAmount = await toTokenAmount(connection, baseMint, amount);

  transaction.add(
    createWithdrawMarginInstruction({
      programId,
      trader: publicKey,
      market,
      marginAccount,
      vault,
      traderTokenAccount,
      amount: rawAmount,
    }),
  );

  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
    signers,
  });

  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
export function getPendingPayoutPda(market: PublicKey, owner: PublicKey) {
  const programId = getApexProtocolProgramId();
  const [pendingPayout] = PublicKey.findProgramAddressSync(
    [Buffer.from("pending_payout"), market.toBuffer(), owner.toBuffer()],
    programId,
  );

  return pendingPayout;
}

/**
 * Reads the balance a trader is still owed from a close that the protocol had
 * to defer because its liquidity pool and insurance fund were momentarily
 * short. Returns 0 when no pending payout account exists.
 */
export async function fetchPendingPayout(
  connection: Connection,
  pair: string,
  owner: PublicKey,
): Promise<number> {
  const { market } = getMarketPdas(pair);
  const account = await connection.getAccountInfo(getPendingPayoutPda(market, owner));
  if (!account) return 0;

  // Layout: discriminator(8) + owner(32) + market(32) + amount(8)
  return Number(readU64LE(account.data, 8 + 32 + 32)) / SIZE_DECIMALS;
}

/**
 * Claims a previously deferred payout. Draws from the liquidity pool first and
 * then the insurance fund, paying out as much as the protocol can currently
 * back and leaving any remainder claimable later.
 */
export async function claimPendingPayout({
  connection,
  publicKey,
  sendTransaction,
  pair,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  pair: string;
}) {
  const { programId, baseMint, market } = getMarketPdas(pair);
  const marketAccount = await connection.getAccountInfo(market);

  if (!marketAccount) {
    throw new Error("This market has not been initialized yet.");
  }

  const vault = readMarketVault(marketAccount.data);
  const traderTokenAccount = await getAssociatedTokenAddress(baseMint, publicKey);

  if (!(await connection.getAccountInfo(traderTokenAccount))) {
    throw new Error("Your wallet does not have a collateral token account for this market.");
  }

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: market, isSigner: false, isWritable: true },
        {
          pubkey: getPendingPayoutPda(market, publicKey),
          isSigner: false,
          isWritable: true,
        },
        { pubkey: vault, isSigner: false, isWritable: true },
        { pubkey: traderTokenAccount, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: CLAIM_PENDING_PAYOUT_DISCRIMINATOR,
    }),
  );

  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
  });

  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

export async function placeProtocolOrder({
  connection,
  publicKey,
  sendTransaction,
  pair,
  side,
  price,
  sizeUsdc,
  leverage,
}: PlaceProtocolOrderParams) {
  const { programId, baseMint, market, orderBook } = getMarketPdas(pair);
  const marketAccount = await connection.getAccountInfo(market);
  const orderBookAccount = await connection.getAccountInfo(orderBook);
  const transaction = new Transaction();
  const signers: Keypair[] = [];
  let vault: PublicKey;

  if (!marketAccount || !orderBookAccount) {
    const vaultKeypair = Keypair.generate();
    vault = vaultKeypair.publicKey;
    signers.push(vaultKeypair);
    transaction.add(
      createInitializeMarketInstruction({
        programId,
        authority: publicKey,
        market,
        orderBook,
        baseMint,
        vault,
      }),
    );
  } else {
    vault = readMarketVault(marketAccount.data);
  }

  const marginAccount = getTraderMarginPda(market, publicKey);
  const traderTokenAccount = await getAssociatedTokenAddress(baseMint, publicKey);

  transaction.add(
    createPlaceOrderInstruction({
      programId,
      signer: publicKey,
      market,
      orderBook,
      marginAccount,
      vault,
      traderTokenAccount,
      side,
      price,
      sizeUsdc,
      leverage,
    }),
  );
  if (signers.length > 0) {
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = publicKey;
    transaction.partialSign(...signers);
  }

  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
    signers,
  });

  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}



