import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/server/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = getSessionFromRequest(request);

  return NextResponse.json({ user: session ? { id: session.id, name: session.name, email: session.email } : null });
}
