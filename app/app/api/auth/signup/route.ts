import { NextResponse } from "next/server";
import { ensureAuthSchema, getPool } from "@/lib/server/db";
import { hashPassword, normalizeEmail, setAuthCookie } from "@/lib/server/auth";

export const runtime = "nodejs";

type SignupBody = {
  name?: string;
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as SignupBody;
  const name = body.name?.trim() || "ApeX Trader";
  const email = normalizeEmail(body.email || "");
  const password = body.password || "";

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  await ensureAuthSchema();

  try {
    const result = await getPool().query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,
      [name, email, hashPassword(password)]
    );

    const user = result.rows[0] as { id: string; name: string; email: string };
    const response = NextResponse.json({ user });
    setAuthCookie(response, user);

    return response;
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
    }

    console.error("Signup failed", error);
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
