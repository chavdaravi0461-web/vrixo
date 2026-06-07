import { NextResponse } from "next/server";
import { commerceIntel } from "@/lib/commerce-intelligence";
import { requireAdminApi } from "@/lib/require-admin";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return auth.response;

  const [segments, anomalies] = await Promise.all([
    commerceIntel.analyzeSegments(),
    commerceIntel.detectAnomalies(),
  ]);

  return NextResponse.json({
    segments,
    anomalies,
    lastAnalysis: commerceIntel.getLastAnalysis(),
  });
});
