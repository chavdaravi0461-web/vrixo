import { NextResponse } from "next/server";
import { publishRealtime } from "@/lib/realtime";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";

export async function POST(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-admin-key"], [process.env.ADMIN_API_KEY]);
  if (authError) return authError;

  const body = await request.json().catch(() => ({}));
  const cmd = String(body.command ?? "");
  const payload = body.payload ?? {};

  if (!cmd) return NextResponse.json({ message: "command required" }, { status: 400 });

  try {
    await publishRealtime("realtime:commands", { command: cmd, payload, issuedBy: "server", createdAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
