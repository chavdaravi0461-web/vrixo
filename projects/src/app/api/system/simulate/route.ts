import { NextResponse } from "next/server";
import { failureSimulator } from "@/lib/failure-simulation";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-simulation-key"], [
    process.env.FAILURE_SIMULATION_KEY,
    process.env.CRON_SECRET
  ]);
  if (authError) return authError;

  const predictions = await failureSimulator.runAllSimulations();
  return NextResponse.json({
    predictions,
    history: failureSimulator.getHistory().slice(-100),
    scenarios: failureSimulator.getScenarios(),
  });
});

export const GET = safeRoute(async function GET(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-simulation-key"], [
    process.env.FAILURE_SIMULATION_KEY,
    process.env.CRON_SECRET
  ]);
  if (authError) return authError;

  return NextResponse.json({
    scenarios: failureSimulator.getScenarios(),
    historyCount: failureSimulator.getHistory().length,
  });
});
