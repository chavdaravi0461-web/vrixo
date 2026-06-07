import { NextResponse } from "next/server";
import { checkAllDependencies, getSystemStatus, isDegraded, getAllDependencyStates } from "@/lib/dependency-health";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async function GET(request: Request) {
  const token = request.headers.get("x-internal-token");
  const required = process.env.INTERNAL_API_TOKEN;

  if (required && token !== required) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const depStates = await checkAllDependencies();
  const status = getSystemStatus();
  const degraded = isDegraded();

  return NextResponse.json({
    status,
    degraded,
    timestamp: new Date().toISOString(),
    dependencies: depStates.map((d) => ({
      name: d.name,
      status: d.status,
      failureCount: d.failureCount,
      degraded: d.degradedMode,
      lastFailureAt: d.lastFailureAt,
    })),
    env: {
      sentry: Boolean(process.env.SENTRY_DSN),
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID),
      whatsapp: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN),
      groq: Boolean(process.env.GROQ_API_KEY),
      openai: Boolean(process.env.OPENAI_API_KEY),
    },
  }, { status: status === "healthy" ? 200 : status === "degraded" ? 200 : 503 });
});
