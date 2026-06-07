import { NextResponse } from "next/server";
import { chaosEngine } from "@/lib/chaos-engineering";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    return NextResponse.json(chaosEngine.getStats());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "cycle");

    if (action === "start") {
      const interval = Number(body.intervalMs ?? 300_000);
      await chaosEngine.start(interval);
      return NextResponse.json({ started: true, intervalMs: interval });
    }
    if (action === "stop") {
      chaosEngine.stop();
      return NextResponse.json({ stopped: true });
    }
    if (action === "cycle") {
      const results = await chaosEngine.runCycle();
      return NextResponse.json({ cycleCompleted: true, injections: results.length, results });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
