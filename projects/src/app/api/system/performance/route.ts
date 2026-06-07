import { NextResponse } from "next/server";
import { getPerformanceStats, getRouteMetrics, startPerformanceIntelligence, stopPerformanceIntelligence } from "@/lib/performance-intelligence";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const route = url.searchParams.get("route");
    const method = url.searchParams.get("method");

    if (route && method) {
      return NextResponse.json(getRouteMetrics(route, method));
    }

    return NextResponse.json(getPerformanceStats());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "");

    if (action === "start") {
      await startPerformanceIntelligence();
      return NextResponse.json({ started: true });
    }
    if (action === "stop") {
      stopPerformanceIntelligence();
      return NextResponse.json({ stopped: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
