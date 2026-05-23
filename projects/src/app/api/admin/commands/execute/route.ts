import { NextResponse } from "next/server";
import { publishRealtime } from "@/lib/realtime";

export async function POST(request: Request) {
  const key = request.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_API_KEY) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const cmd = String(body.command ?? "");
  const payload = body.payload ?? {};

  if (!cmd) return NextResponse.json({ message: "command required" }, { status: 400 });

  try {
    await publishRealtime("realtime:commands", { command: cmd, payload, issuedBy: key, createdAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
