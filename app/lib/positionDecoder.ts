/**
 * Decoder for on-chain Position PDA accounts.
 *
 * Layout matches programs/apex_protocol/src/state/position.rs
 */

import { Connection, PublicKey, type AccountInfo } from "@solana/web3.js";
import { getApexProtocolProgramId, getMarketPdas } from "./apexProtocol";
import { PRICE_DECIMALS, SIZE_DECIMALS } from "./constants";
import type { Position } from "./types";

export interface DecodedOnChainPosition {
  owner: string;
  market: string;
  side: "Long" | "Short";
  collateral: number;
  size: number;
  entryPrice: number;
  leverage: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  fundingSettled: number;
  createdAt: number;
  bump: number;
}

function readU64LE(buffer: Buffer, offset: number): bigint {
  if (typeof buffer.readBigUInt64LE === "function") {
    return buffer.readBigUInt64LE(offset);
  }
  const low = BigInt(buffer.readUInt32LE(offset));
  const high = BigInt(buffer.readUInt32LE(offset + 4));
  return (high << BigInt(32)) | low;
}

function readI64LE(buffer: Buffer, offset: number): bigint {
  if (typeof buffer.readBigInt64LE === "function") {
    return buffer.readBigInt64LE(offset);
  }
  const low = BigInt(buffer.readUInt32LE(offset));
  const high = BigInt(buffer.readInt32LE(offset + 4));
  return (high << BigInt(32)) | low;
}

export function decodePositionAccount(data: Buffer): DecodedOnChainPosition | null {
  // Account must have at least 131 bytes (8-byte discriminator + fields)
  if (data.length < 131) return null;

  try {
    let offset = 8; // skip 8-byte discriminator

    const owner = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;

    const market = new PublicKey(data.subarray(offset, offset + 32)).toBase58();
    offset += 32;

    const sideByte = data.readUInt8(offset);
    const side: "Long" | "Short" = sideByte === 0 ? "Long" : "Short";
    offset += 1;

    const collateral = Number(readU64LE(data, offset)) / SIZE_DECIMALS;
    offset += 8;

    const size = Number(readU64LE(data, offset)) / SIZE_DECIMALS;
    offset += 8;

    const entryPrice = Number(readU64LE(data, offset)) / PRICE_DECIMALS;
    offset += 8;

    const leverage = data.readUInt8(offset);
    offset += 1;

    const liquidationPrice = Number(readU64LE(data, offset)) / PRICE_DECIMALS;
    offset += 8;

    const unrealizedPnl = Number(readI64LE(data, offset)) / SIZE_DECIMALS;
    offset += 8;

    const fundingSettled = Number(readI64LE(data, offset)) / SIZE_DECIMALS;
    offset += 8;

    const createdAt = Number(readI64LE(data, offset));
    offset += 8;

    const bump = data.readUInt8(offset);

    // If size is 0 or owner is default/empty, the position is inactive/closed
    if (size <= 0 || owner === PublicKey.default.toBase58()) {
      return null;
    }

    return {
      owner,
      market,
      side,
      collateral,
      size,
      entryPrice,
      leverage,
      liquidationPrice,
      unrealizedPnl,
      fundingSettled,
      createdAt,
      bump,
    };
  } catch (err) {
    console.error("Failed to decode position account:", err);
    return null;
  }
}

/**
 * Derive the Position PDA address for a given market and trader.
 */
export function getPositionPda(market: PublicKey, owner: PublicKey): PublicKey {
  const programId = getApexProtocolProgramId();
  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), market.toBuffer(), owner.toBuffer()],
    programId
  );
  return positionPda;
}

/**
 * Fetch and decode the on-chain Position PDA for a trader in a specific market pair.
 */
export async function fetchOnChainPosition(
  connection: Connection,
  pair: string,
  owner: PublicKey
): Promise<DecodedOnChainPosition | null> {
  try {
    const { market } = getMarketPdas(pair);
    const positionPda = getPositionPda(market, owner);
    const accountInfo = await connection.getAccountInfo(positionPda);

    if (!accountInfo) return null;
    return decodePositionAccount(accountInfo.data as Buffer);
  } catch {
    return null;
  }
}

/**
 * Subscribe to real-time changes on a trader's Position PDA.
 */
export function subscribeOnChainPosition(
  connection: Connection,
  pair: string,
  owner: PublicKey,
  callback: (position: DecodedOnChainPosition | null) => void
): () => void {
  try {
    const { market } = getMarketPdas(pair);
    const positionPda = getPositionPda(market, owner);

    const listenerId = connection.onAccountChange(
      positionPda,
      (account: AccountInfo<Buffer>) => {
        callback(decodePositionAccount(account.data));
      },
      "confirmed"
    );

    return () => {
      void connection.removeAccountChangeListener(listenerId);
    };
  } catch {
    return () => {};
  }
}

/**
 * Convert a decoded on-chain position to the frontend Position model.
 */
export function mapOnChainToFrontendPosition(
  decoded: DecodedOnChainPosition,
  pair: string,
  currentMarkPrice: number
): Position {
  const markPrice = currentMarkPrice > 0 ? currentMarkPrice : decoded.entryPrice;
  const diff =
    decoded.side === "Long"
      ? markPrice - decoded.entryPrice
      : decoded.entryPrice - markPrice;
  const pnl = diff * decoded.size;
  const initialMargin = decoded.collateral > 0 ? decoded.collateral : (decoded.size * decoded.entryPrice) / (decoded.leverage || 1);
  const roi = initialMargin > 0 ? (pnl / initialMargin) * 100 : 0;

  return {
    id: `onchain-${decoded.market}-${decoded.owner}`,
    pair,
    side: decoded.side,
    leverage: decoded.leverage,
    size: decoded.size,
    entryPrice: decoded.entryPrice,
    markPrice,
    liqPrice: decoded.liquidationPrice,
    pnl,
    roi,
  };
}
