import type { SendTransactionOptions } from "@solana/wallet-adapter-base";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  type AccountInfo,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getApexProtocolProgramId } from "./apexProtocol";
import { ORDER_SIZE_BYTES, PRICE_DECIMALS } from "./constants";
import type { OrderBookLevel } from "./types";

type SendTransaction = (
  transaction: Transaction,
  connection: Connection,
  options?: SendTransactionOptions,
) => Promise<string>;

/**
 * Anchor instruction discriminators — first 8 bytes of sha256("global:<name>").
 * Hardcoded because computing sha256 in the browser is async and the rest of
 * the client already follows this pattern.
 */
const DISCRIMINATORS = {
  initializeSpotMarket: Buffer.from([234, 196, 128, 44, 94, 15, 48, 201]),
  depositSpot: Buffer.from([59, 165, 165, 50, 18, 23, 158, 185]),
  withdrawSpot: Buffer.from([228, 41, 126, 4, 112, 18, 221, 112]),
  placeSpotOrder: Buffer.from([45, 79, 81, 160, 248, 90, 91, 220]),
  cancelSpotOrder: Buffer.from([167, 233, 230, 232, 187, 191, 30, 211]),
  matchSpotOrders: Buffer.from([65, 14, 80, 122, 12, 6, 136, 178]),
} as const;

export type SpotSide = "Buy" | "Sell";

export interface SpotBalances {
  baseFree: number;
  baseLocked: number;
  quoteFree: number;
  quoteLocked: number;
}

function readU64LE(buffer: Buffer, offset: number): bigint {
  return buffer.readBigUInt64LE(offset);
}

/** PDA for a spot market, keyed by its token pair. */
export function getSpotMarketPda(baseMint: PublicKey, quoteMint: PublicKey) {
  const programId = getApexProtocolProgramId();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("spot_market"), baseMint.toBuffer(), quoteMint.toBuffer()],
    programId,
  );
  return pda;
}

export function getSpotOrderBookPda(spotMarket: PublicKey) {
  const programId = getApexProtocolProgramId();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("spot_orderbook"), spotMarket.toBuffer()],
    programId,
  );
  return pda;
}

export function getSpotBalancePda(spotMarket: PublicKey, owner: PublicKey) {
  const programId = getApexProtocolProgramId();
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("spot_balance"), spotMarket.toBuffer(), owner.toBuffer()],
    programId,
  );
  return pda;
}

/**
 * SpotMarket layout (see programs/apex_protocol/src/state/spot.rs):
 * discriminator(8) authority(32) base_mint(32) quote_mint(32)
 * base_vault(32) quote_vault(32) fee_rate(8) fees_accrued(8) bump(1)
 */
export interface DecodedSpotMarket {
  authority: PublicKey;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseVault: PublicKey;
  quoteVault: PublicKey;
  feeRateBps: number;
  feesAccrued: bigint;
}

export function decodeSpotMarket(data: Buffer): DecodedSpotMarket {
  return {
    authority: new PublicKey(data.subarray(8, 40)),
    baseMint: new PublicKey(data.subarray(40, 72)),
    quoteMint: new PublicKey(data.subarray(72, 104)),
    baseVault: new PublicKey(data.subarray(104, 136)),
    quoteVault: new PublicKey(data.subarray(136, 168)),
    feeRateBps: Number(readU64LE(data, 168)),
    feesAccrued: readU64LE(data, 176),
  };
}

export async function fetchSpotMarket(
  connection: Connection,
  baseMint: PublicKey,
  quoteMint: PublicKey,
): Promise<DecodedSpotMarket | null> {
  const account = await connection.getAccountInfo(getSpotMarketPda(baseMint, quoteMint));
  if (!account) return null;
  return decodeSpotMarket(account.data);
}

/**
 * SpotBalance layout: discriminator(8) owner(32) market(32)
 * base_free(8) base_locked(8) quote_free(8) quote_locked(8) bump(1)
 */
export function decodeSpotBalance(
  data: Buffer,
  baseDecimals: number,
  quoteDecimals: number,
): SpotBalances {
  const baseScale = 10 ** baseDecimals;
  const quoteScale = 10 ** quoteDecimals;

  return {
    baseFree: Number(readU64LE(data, 72)) / baseScale,
    baseLocked: Number(readU64LE(data, 80)) / baseScale,
    quoteFree: Number(readU64LE(data, 88)) / quoteScale,
    quoteLocked: Number(readU64LE(data, 96)) / quoteScale,
  };
}

export async function fetchSpotBalances(
  connection: Connection,
  spotMarket: PublicKey,
  owner: PublicKey,
  baseDecimals: number,
  quoteDecimals: number,
): Promise<SpotBalances> {
  const account = await connection.getAccountInfo(getSpotBalancePda(spotMarket, owner));
  if (!account) {
    return { baseFree: 0, baseLocked: 0, quoteFree: 0, quoteLocked: 0 };
  }
  return decodeSpotBalance(account.data, baseDecimals, quoteDecimals);
}

/**
 * Decodes the spot order book. Reuses the shared `Order` layout, where for spot
 * `size` is in base units and `locked_collateral` is the reserved token amount.
 */
export function decodeSpotOrderBook(data: Buffer, baseDecimals: number) {
  const baseScale = 10 ** baseDecimals;
  let offset = 8 + 32; // discriminator + market

  const readLevels = (count: number): OrderBookLevel[] => {
    const levels: OrderBookLevel[] = [];
    for (let i = 0; i < count; i += 1) {
      const status = data.readUInt8(offset + 58);
      if (status === 0) {
        levels.push({
          price: Number(readU64LE(data, offset + 33)) / PRICE_DECIMALS,
          size: Number(readU64LE(data, offset + 41)) / baseScale,
        });
      }
      offset += ORDER_SIZE_BYTES;
    }
    return levels;
  };

  const asksLength = data.readUInt32LE(offset);
  offset += 4;
  const asks = readLevels(asksLength);

  const bidsLength = data.readUInt32LE(offset);
  offset += 4;
  const bids = readLevels(bidsLength);

  return {
    bids: bids.sort((a, b) => b.price - a.price),
    asks: asks.sort((a, b) => a.price - b.price),
  };
}

export async function fetchSpotOrderBook(
  connection: Connection,
  spotMarket: PublicKey,
  baseDecimals: number,
) {
  const account = await connection.getAccountInfo(getSpotOrderBookPda(spotMarket));
  if (!account) return { bids: [], asks: [] };
  return decodeSpotOrderBook(account.data, baseDecimals);
}

export function subscribeSpotOrderBook(
  connection: Connection,
  spotMarket: PublicKey,
  baseDecimals: number,
  callback: (data: { bids: OrderBookLevel[]; asks: OrderBookLevel[] }) => void,
) {
  const listenerId = connection.onAccountChange(
    getSpotOrderBookPda(spotMarket),
    (account: AccountInfo<Buffer>) => {
      callback(decodeSpotOrderBook(account.data, baseDecimals));
    },
    "confirmed",
  );

  return () => {
    void connection.removeAccountChangeListener(listenerId);
  };
}

async function getDecimals(connection: Connection, mint: PublicKey) {
  const info = await getMint(connection, mint);
  return info.decimals;
}

function toRaw(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * 10 ** decimals));
}

/** Creates the spot market and its order book. One-time, per token pair. */
export async function initializeSpotMarket({
  connection,
  publicKey,
  sendTransaction,
  baseMint,
  quoteMint,
  feeRateBps = 10,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  feeRateBps?: number;
}) {
  if (feeRateBps <= 0 || feeRateBps > 100) {
    throw new Error("Spot fee rate must be between 1 and 100 bps.");
  }

  const programId = getApexProtocolProgramId();
  const spotMarket = getSpotMarketPda(baseMint, quoteMint);
  const orderBook = getSpotOrderBookPda(spotMarket);

  // Vaults are plain token accounts owned by the market PDA, created here.
  const baseVault = Keypair.generate();
  const quoteVault = Keypair.generate();

  const data = Buffer.alloc(16);
  DISCRIMINATORS.initializeSpotMarket.copy(data, 0);
  data.writeBigUInt64LE(BigInt(feeRateBps), 8);

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: spotMarket, isSigner: false, isWritable: true },
        { pubkey: baseMint, isSigner: false, isWritable: false },
        { pubkey: quoteMint, isSigner: false, isWritable: false },
        { pubkey: baseVault.publicKey, isSigner: true, isWritable: true },
        { pubkey: quoteVault.publicKey, isSigner: true, isWritable: true },
        { pubkey: orderBook, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      data,
    }),
  );

  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
    signers: [baseVault, quoteVault],
  });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/** Moves tokens from the wallet into the market's vaults as tradable balance. */
export async function depositSpot({
  connection,
  publicKey,
  sendTransaction,
  baseMint,
  quoteMint,
  baseAmount,
  quoteAmount,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseAmount: number;
  quoteAmount: number;
}) {
  if (baseAmount <= 0 && quoteAmount <= 0) {
    throw new Error("Enter a base or quote amount greater than 0.");
  }

  const market = await fetchSpotMarket(connection, baseMint, quoteMint);
  if (!market) throw new Error("This spot market has not been initialized yet.");

  const [baseDecimals, quoteDecimals] = await Promise.all([
    getDecimals(connection, baseMint),
    getDecimals(connection, quoteMint),
  ]);

  const data = Buffer.alloc(24);
  DISCRIMINATORS.depositSpot.copy(data, 0);
  data.writeBigUInt64LE(toRaw(baseAmount, baseDecimals), 8);
  data.writeBigUInt64LE(toRaw(quoteAmount, quoteDecimals), 16);

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: getApexProtocolProgramId(),
      keys: await spotBalanceKeys({
        connection,
        publicKey,
        market,
        baseMint,
        quoteMint,
        writableMarket: false,
        includeSystemProgram: true,
      }),
      data,
    }),
  );

  const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/** Withdraws unlocked balance back to the wallet. */
export async function withdrawSpot({
  connection,
  publicKey,
  sendTransaction,
  baseMint,
  quoteMint,
  baseAmount,
  quoteAmount,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  baseAmount: number;
  quoteAmount: number;
}) {
  if (baseAmount <= 0 && quoteAmount <= 0) {
    throw new Error("Enter a base or quote amount greater than 0.");
  }

  const market = await fetchSpotMarket(connection, baseMint, quoteMint);
  if (!market) throw new Error("This spot market has not been initialized yet.");

  const [baseDecimals, quoteDecimals] = await Promise.all([
    getDecimals(connection, baseMint),
    getDecimals(connection, quoteMint),
  ]);

  const data = Buffer.alloc(24);
  DISCRIMINATORS.withdrawSpot.copy(data, 0);
  data.writeBigUInt64LE(toRaw(baseAmount, baseDecimals), 8);
  data.writeBigUInt64LE(toRaw(quoteAmount, quoteDecimals), 16);

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: getApexProtocolProgramId(),
      keys: await spotBalanceKeys({
        connection,
        publicKey,
        market,
        baseMint,
        quoteMint,
        writableMarket: false,
        includeSystemProgram: false,
      }),
      data,
    }),
  );

  const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/**
 * Shared account list for deposit_spot / withdraw_spot, which differ only in
 * whether they need the system program (deposit may init the balance PDA).
 */
async function spotBalanceKeys({
  connection,
  publicKey,
  market,
  baseMint,
  quoteMint,
  includeSystemProgram,
}: {
  connection: Connection;
  publicKey: PublicKey;
  market: DecodedSpotMarket;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  writableMarket: boolean;
  includeSystemProgram: boolean;
}) {
  const spotMarket = getSpotMarketPda(baseMint, quoteMint);
  const [traderBase, traderQuote] = await Promise.all([
    getAssociatedTokenAddress(baseMint, publicKey),
    getAssociatedTokenAddress(quoteMint, publicKey),
  ]);

  const [baseAccount, quoteAccount] = await Promise.all([
    connection.getAccountInfo(traderBase),
    connection.getAccountInfo(traderQuote),
  ]);
  if (!baseAccount || !quoteAccount) {
    throw new Error(
      "Your wallet needs token accounts for both sides of this market before trading.",
    );
  }

  const keys = [
    { pubkey: publicKey, isSigner: true, isWritable: true },
    { pubkey: spotMarket, isSigner: false, isWritable: false },
    { pubkey: getSpotBalancePda(spotMarket, publicKey), isSigner: false, isWritable: true },
    { pubkey: market.baseVault, isSigner: false, isWritable: true },
    { pubkey: market.quoteVault, isSigner: false, isWritable: true },
    { pubkey: traderBase, isSigner: false, isWritable: true },
    { pubkey: traderQuote, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  if (includeSystemProgram) {
    keys.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false });
  }

  return keys;
}

/**
 * Places a spot limit order. `size` is in base units; buys reserve quote and
 * sells reserve base, both up front.
 */
export async function placeSpotOrder({
  connection,
  publicKey,
  sendTransaction,
  baseMint,
  quoteMint,
  side,
  price,
  size,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  side: SpotSide;
  price: number;
  size: number;
}) {
  if (price <= 0 || size <= 0) {
    throw new Error("Price and size must both be greater than 0.");
  }

  const spotMarket = getSpotMarketPda(baseMint, quoteMint);
  const market = await fetchSpotMarket(connection, baseMint, quoteMint);
  if (!market) throw new Error("This spot market has not been initialized yet.");

  const baseDecimals = await getDecimals(connection, baseMint);

  const data = Buffer.alloc(25);
  DISCRIMINATORS.placeSpotOrder.copy(data, 0);
  // Side::Long == buy, Side::Short == sell
  data.writeUInt8(side === "Buy" ? 0 : 1, 8);
  data.writeBigUInt64LE(BigInt(Math.round(price * PRICE_DECIMALS)), 9);
  data.writeBigUInt64LE(toRaw(size, baseDecimals), 17);

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: getApexProtocolProgramId(),
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: spotMarket, isSigner: false, isWritable: false },
        { pubkey: getSpotOrderBookPda(spotMarket), isSigner: false, isWritable: true },
        { pubkey: getSpotBalancePda(spotMarket, publicKey), isSigner: false, isWritable: true },
        { pubkey: spotMarket, isSigner: false, isWritable: false },
      ],
      data,
    }),
  );

  const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}

/** Cancels a resting spot order by its index within its own side of the book. */
export async function cancelSpotOrder({
  connection,
  publicKey,
  sendTransaction,
  baseMint,
  quoteMint,
  orderIndex,
  side,
}: {
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: SendTransaction;
  baseMint: PublicKey;
  quoteMint: PublicKey;
  orderIndex: number;
  side: SpotSide;
}) {
  const spotMarket = getSpotMarketPda(baseMint, quoteMint);

  const data = Buffer.alloc(17);
  DISCRIMINATORS.cancelSpotOrder.copy(data, 0);
  data.writeBigUInt64LE(BigInt(orderIndex), 8);
  data.writeUInt8(side === "Buy" ? 0 : 1, 16);

  const transaction = new Transaction().add(
    new TransactionInstruction({
      programId: getApexProtocolProgramId(),
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: false },
        { pubkey: spotMarket, isSigner: false, isWritable: false },
        { pubkey: getSpotOrderBookPda(spotMarket), isSigner: false, isWritable: true },
        { pubkey: getSpotBalancePda(spotMarket, publicKey), isSigner: false, isWritable: true },
        { pubkey: spotMarket, isSigner: false, isWritable: false },
      ],
      data,
    }),
  );

  const signature = await sendTransaction(transaction, connection, { skipPreflight: false });
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}
