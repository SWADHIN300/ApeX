import { NextResponse } from "next/server";
import { ensureAuthSchema, getPool } from "@/lib/server/db";
import { normalizeEmail, setAuthCookie, verifyPassword } from "@/lib/server/auth";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as LoginBody;
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";

  await ensureAuthSchema();

  const result = await getPool().query(
    `SELECT id, name, email, password_hash
     FROM users
     WHERE email = $1
     LIMIT 1`,
    [email]
  );
  const user = result.rows[0] as
    | { id: string; name: string; email: string; password_hash: string }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const safeUser = { id: user.id, name: user.name, email: user.email };
  const response = NextResponse.json({ user: safeUser });
  setAuthCookie(response, safeUser);

  return response;
}
