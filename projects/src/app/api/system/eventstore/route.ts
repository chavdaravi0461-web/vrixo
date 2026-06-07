import { NextResponse } from "next/server";
import { getStreamEvents, verifyStreamIntegrity, appendEvent } from "@/lib/immutable-event-store";
import { requireOwnerAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const stream = url.searchParams.get("stream");
    const streamId = url.searchParams.get("streamId");
    const verify = url.searchParams.get("verify") === "true";

    if (!stream || !streamId) {
      return NextResponse.json({ error: "stream and streamId required" }, { status: 400 });
    }

    if (verify) {
      const integrity = await verifyStreamIntegrity(stream, streamId);
      return NextResponse.json({ integrity, events: await getStreamEvents(stream, streamId) });
    }

    const events = await getStreamEvents(stream, streamId);
    return NextResponse.json({ stream, streamId, eventCount: events.length, events });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwnerAdminApi(request);
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { stream, streamId, type, data, metadata } = body;

    if (!stream || !streamId || !type || !data) {
      return NextResponse.json({ error: "stream, streamId, type, data required" }, { status: 400 });
    }

    const event = await appendEvent(stream, streamId, type, data, metadata ?? {});
    return NextResponse.json({ appended: true, event });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
