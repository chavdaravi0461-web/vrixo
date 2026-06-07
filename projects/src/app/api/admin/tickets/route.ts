import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getTickets } from "@/lib/support/tickets";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "all";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  const tickets = await getTickets({ status, limit, offset });
  return NextResponse.json({ tickets });
});
