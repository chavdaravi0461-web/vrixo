import { requireAdminApi } from "@/lib/require-admin";
import { getRecentEvents, REALTIME_CHANNEL, type AppEvent } from "@/lib/event-bus";
import { getRedis, isRedisAvailable } from "@/lib/redis";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async function GET(request: Request) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const encoder = new TextEncoder();
  const abortSignal = request.signal;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AppEvent | { type: string; payload: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      send({ type: "connected", payload: { ts: new Date().toISOString() } });
      for (const event of await getRecentEvents(25)) send(event);

      const interval = setInterval(() => send({ type: "heartbeat", payload: { ts: new Date().toISOString() } }), 25000);

      if (isRedisAvailable()) {
        const subscriber = getRedis()!.duplicate();
        try {
          await subscriber.connect();
          subscriber.on("message", (_channel, message) => {
            try {
              send(JSON.parse(message) as AppEvent);
            } catch {
              send({ type: "raw", payload: message });
            }
          });
          await subscriber.subscribe(REALTIME_CHANNEL);

          abortSignal.addEventListener("abort", async () => {
            clearInterval(interval);
            try {
              await subscriber.quit();
            } catch {
              subscriber.disconnect();
            }
            controller.close();
          });
          return;
        } catch {
          send({ type: "degraded", payload: { reason: "redis_unavailable" } });
        }
      } else {
        send({ type: "degraded", payload: { reason: "redis_unavailable" } });
      }

      abortSignal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive"
    }
  });
});
