import {
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as verifySignature,
} from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export const PAPER_SESSION_COOKIE = "apex_paper_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const CHALLENGE_SECONDS = 5 * 60;

export type PaperSession = { walletAddress: string; exp: number };

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured.");
  return secret;
}

function encode(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signatureFor(payload: string) {
  return createHmac("sha256", getSecret()).update(payload).digest();
}

export function createPaperChallenge(walletAddress: string) {
  const nonce = randomBytes(24).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + CHALLENGE_SECONDS * 1000);
  const message = [
    "Sign in to ApeX Paper Trading",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    `Expires At: ${expiresAt.toISOString()}`,
    "This signature only saves or restores a virtual paper trading account. It does not authorize a token transfer.",
  ].join("\n");

  return { nonce, message, expiresAt };
}

export function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signatureBase64: string,
) {
  try {
    const publicKey = new PublicKey(walletAddress);
    const signature = Buffer.from(signatureBase64, "base64");
    if (signature.length !== 64) return false;

    // A Solana public key is the 32-byte Ed25519 key in an SPKI wrapper.
    const spkiPrefix = Buffer.from("302a300506032b6570032100", "hex");
    const key = createPublicKey({
      key: Buffer.concat([spkiPrefix, publicKey.toBuffer()]),
      format: "der",
      type: "spki",
    });

    return verifySignature(null, Buffer.from(message, "utf8"), key, signature);
  } catch {
    return false;
  }
}

export function createPaperSessionToken(walletAddress: string) {
  const payload = encode(
    JSON.stringify({
      walletAddress,
      exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
    } satisfies PaperSession),
  );
  return `${payload}.${signatureFor(payload).toString("base64url")}`;
}

export function readPaperSession(request: NextRequest): PaperSession | null {
  const token = request.cookies.get(PAPER_SESSION_COOKIE)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const expected = signatureFor(payload);
    const supplied = Buffer.from(signature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return null;
    }

    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PaperSession;
    if (
      !session.walletAddress ||
      !Number.isFinite(session.exp) ||
      session.exp <= Date.now() / 1000
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setPaperSessionCookie(response: NextResponse, walletAddress: string) {
  response.cookies.set({
    name: PAPER_SESSION_COOKIE,
    value: createPaperSessionToken(walletAddress),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export function clearPaperSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: PAPER_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function validateWalletAddress(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    return new PublicKey(value).toBase58();
  } catch {
    return null;
  }
}
