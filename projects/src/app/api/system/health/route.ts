import { NextResponse } from "next/server";
import { runHealthCheck } from "@/lib/health-system";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-health-key", "x-internal-key"], [
    process.env.HEALTH_CHECK_KEY,
    process.env.INTERNAL_HEALTH_KEY,
    process.env.CRON_SECRET
  ]);
  if (authError) return authError;

  const health = await runHealthCheck();
  const status = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
  return NextResponse.json(health, { status });
});
