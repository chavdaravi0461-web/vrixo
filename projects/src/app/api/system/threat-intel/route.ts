import { NextResponse } from "next/server";
import { threatIntel } from "@/lib/autonomous-threat-intel";
import { requireAdminApi } from "@/lib/require-admin";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(threatIntel.getStats());
});

export const POST = safeRoute(async function POST(request: Request) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const input = String(body.input ?? "");
  const source = String(body.source ?? "api");

  if (!input) {
    return NextResponse.json({ message: "Input required" }, { status: 400 });
  }

  const signal = threatIntel.analyze(input, source);
  return NextResponse.json({ detected: signal !== null, signal });
});
