import { NextResponse } from "next/server";
import { economicIntelligence } from "@/services/intelligence/economic-intelligence";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "gmv";

    switch (type) {
      case "gmv": {
        const gmv = await economicIntelligence.computeGMV();
        const history = url.searchParams.get("history") === "true" ? await economicIntelligence.getGMVHistory() : undefined;
        return NextResponse.json({ gmv, history });
      }
      case "cohorts": {
        const cohorts = await economicIntelligence.computeCohorts();
        return NextResponse.json({ cohorts });
      }
      case "forecast": {
        const forecast = await economicIntelligence.forecastRevenue();
        return NextResponse.json({ forecast });
      }
      case "anomalies": {
        const anomalies = await economicIntelligence.detectAnomalies();
        return NextResponse.json({ anomalies });
      }
      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
