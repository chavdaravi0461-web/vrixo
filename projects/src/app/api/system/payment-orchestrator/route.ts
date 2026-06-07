import { NextResponse } from "next/server";
import { paymentOrchestrator } from "@/services/payment/payment-orchestrator";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const orderId = url.searchParams.get("orderId");
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 });
    }

    const ledger = await paymentOrchestrator.getPaymentLedger(orderId);
    return NextResponse.json({ orderId, entries: ledger });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
