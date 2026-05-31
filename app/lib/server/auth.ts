import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "crypto";
import type { NextRequest, NextResponse } from "next/server";

export const AUTH_COOKIE = "apex_session";

export type AuthSession = {
  id: string;
  email: string;
  name: string;
  exp: number;
};

const oneWeekSeconds = 60 * 60 * 24 * 7;

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  return secret;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function sign(payload: string) {
  return base64Url(createHmac("sha256", getAuthSecret()).update(payload).digest());
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, hash] = storedHash.split(":");

  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(user: Omit<AuthSession, "exp">) {
  const session: AuthSession = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + oneWeekSeconds,
  };
  const payload = base64Url(JSON.stringify(session));

  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token?: string) {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== sign(payload)) return null;

  try {
    const session = JSON.parse(fromBase64Url(payload)) as AuthSession;
    if (!session.id || !session.email || !session.name || session.exp < Date.now() / 1000) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request: NextRequest) {
  return readSessionToken(request.cookies.get(AUTH_COOKIE)?.value);
}

export function setAuthCookie(response: NextResponse, user: Omit<AuthSession, "exp">) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: createSessionToken(user),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: oneWeekSeconds,
  });
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set({
    name: AUTH_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
