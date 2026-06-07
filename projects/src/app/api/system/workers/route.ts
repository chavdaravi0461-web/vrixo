import { NextResponse } from "next/server";
import { workerFabric } from "@/services/workers/worker-fabric";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const metrics = workerFabric.getWorkerMetrics();
    const dlqRecords = await workerFabric.getDeadLetterRecords();
    return NextResponse.json({ ...metrics, deadLetterQueue: dlqRecords });
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

    if (action === "start-cron") {
      await workerFabric.startCronEngine();
      return NextResponse.json({ cronEngineStarted: true });
    }
    if (action === "stop-cron") {
      workerFabric.stopCronEngine();
      return NextResponse.json({ cronEngineStopped: true });
    }
    if (action === "retry-dlq") {
      const queueName = String(body.queueName ?? "");
      const recordId = String(body.recordId ?? "");
      if (!queueName || !recordId) {
        return NextResponse.json({ error: "queueName and recordId required" }, { status: 400 });
      }
      const retried = await workerFabric.retryDeadLetter(queueName, recordId);
      return NextResponse.json({ retried });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
