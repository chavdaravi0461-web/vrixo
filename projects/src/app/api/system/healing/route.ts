import { NextResponse } from "next/server";
import { healingEngine } from "@/services/healing/healing-engine";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-healing-key"], [
    process.env.HEALING_ENGINE_KEY,
    process.env.CRON_SECRET
  ]);
  if (authError) return authError;

  const result = await healingEngine.runHealingCycle();
  return NextResponse.json(result);
});

export const GET = safeRoute(async function GET(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-healing-key"], [
    process.env.HEALING_ENGINE_KEY,
    process.env.CRON_SECRET
  ]);
  if (authError) return authError;

  const stats = healingEngine.getStats();
  return NextResponse.json(stats);
});
