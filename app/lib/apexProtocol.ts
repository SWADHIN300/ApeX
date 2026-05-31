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
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { OrderBookLevel } from "./types";

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
  "E7hafM67eM1VWxo1LvKeYAzK3jk4TZKUbKMQqAadnd2s";
const PLACE_ORDER_DISCRIMINATOR = Buffer.from([
  51, 194, 155, 175, 109, 130, 96, 106,
]);
const INITIALIZE_MARKET_DISCRIMINATOR = Buffer.from([
  35, 35, 189, 193, 155, 48, 170, 203,
]);
const PRICE_DECIMALS = 1_000_000;
const SIZE_DECIMALS = 1_000_000;
const DEFAULT_FEE_RATE_BPS = 4;

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

export function getMarketBaseMint(pair: string) {
  const mintMap = getConfiguredMarketMints();
  const mappedMint = mintMap[pair];
  const fallbackMint = process.env.NEXT_PUBLIC_APEX_BASE_MINT;

  if (mappedMint) return new PublicKey(mappedMint);
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

function readProtocolOrder(data: Buffer, offset: number) {
  const side = data.readUInt8(offset + 32);
  const price = Number(data.readBigUInt64LE(offset + 33)) / PRICE_DECIMALS;
  const size = Number(data.readBigUInt64LE(offset + 41)) / SIZE_DECIMALS;
  const status = data.readUInt8(offset + 50);

  return { side, price, size, status };
}

export function decodeProtocolOrderBook(data: Buffer) {
  let offset = 8 + 32;
  const asksLength = data.readUInt32LE(offset);
  offset += 4;

  const asks: OrderBookLevel[] = [];
  for (let index = 0; index < asksLength; index += 1) {
    const order = readProtocolOrder(data, offset);
    if (order.status === 0) {
      asks.push({ price: order.price, size: order.size });
    }
    offset += 51;
  }

  const bidsLength = data.readUInt32LE(offset);
  offset += 4;

  const bids: OrderBookLevel[] = [];
  for (let index = 0; index < bidsLength; index += 1) {
    const order = readProtocolOrder(data, offset);
    if (order.status === 0) {
      bids.push({ price: order.price, size: order.size });
    }
    offset += 51;
  }

  return {
    bids: bids.sort((a, b) => b.price - a.price),
    asks: asks.sort((a, b) => a.price - b.price),
  };
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

function writeU64LE(buffer: Buffer, value: bigint, offset: number) {
  buffer.writeBigUInt64LE(value, offset);
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
  const oracle = new PublicKey(
    process.env.NEXT_PUBLIC_APEX_ORACLE || SystemProgram.programId.toBase58(),
  );
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
  side,
  price,
  sizeUsdc,
  leverage,
}: {
  programId: PublicKey;
  signer: PublicKey;
  market: PublicKey;
  orderBook: PublicKey;
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
      { pubkey: market, isSigner: false, isWritable: false },
      { pubkey: orderBook, isSigner: false, isWritable: true },
      { pubkey: signer, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
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

  if (!marketAccount || !orderBookAccount) {
    const vault = Keypair.generate();
    signers.push(vault);
    transaction.add(
      createInitializeMarketInstruction({
        programId,
        authority: publicKey,
        market,
        orderBook,
        baseMint,
        vault: vault.publicKey,
      }),
    );
  }

  transaction.add(createPlaceOrderInstruction({
    programId,
    signer: publicKey,
    market,
    orderBook,
    side,
    price,
    sizeUsdc,
    leverage,
  }));
  const signature = await sendTransaction(transaction, connection, {
    skipPreflight: false,
    signers,
  });

  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}
