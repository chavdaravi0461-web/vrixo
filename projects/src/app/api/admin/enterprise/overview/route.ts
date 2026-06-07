import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRecentEvents } from "@/lib/event-bus";
import { withRedis } from "@/lib/redis";
import { safeRoute } from "@/lib/safe-route";

export const dynamic = "force-dynamic";

export const GET = safeRoute(async function GET(request: Request) {
  const guard = await requireAdminApi(request);
  if (!guard.ok) return guard.response;

  const supabase = createAdminClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const results = await Promise.allSettled([
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("order_notifications").select("id", { count: "exact", head: true }).or("status.eq.pending,status.eq.retry_scheduled"),
    supabase.from("order_notifications").select("id", { count: "exact", head: true }).eq("status", "failed"),
    supabase.from("customer_behavior_events").select("id", { count: "exact", head: true }).gte("occurred_at", since),
    supabase.from("razorpay_webhook_events").select("event_id", { count: "exact", head: true }).gte("created_at", since),
    supabase.from("orders").select("total, payment_status, order_status").gte("created_at", since),
    withRedis(async (client) => {
      const pong = await client.ping();
      return pong === "PONG" ? "online" : "degraded";
    }, "offline"),
    getRecentEvents(50)
  ]);

  const orders24h = results[0].status === "fulfilled" ? results[0].value.count : 0;
  const pendingNotifications = results[1].status === "fulfilled" ? results[1].value.count : 0;
  const failedNotifications = results[2].status === "fulfilled" ? results[2].value.count : 0;
  const behavior24h = results[3].status === "fulfilled" ? results[3].value.count : 0;
  const webhook24h = results[4].status === "fulfilled" ? results[4].value.count : 0;
  const revenueRows = results[5].status === "fulfilled" ? results[5].value.data : [];
  const redisStatus = results[6].status === "fulfilled" ? results[6].value : "offline";
  const events = results[7].status === "fulfilled" ? results[7].value : [];

  const revenue24h = (revenueRows ?? [])
    .filter((order) => String(order.order_status).toLowerCase() !== "cancelled")
    .reduce((sum, order) => sum + Number(order.total ?? 0), 0);

  return NextResponse.json({
    health: {
      redis: redisStatus,
      sentry: Boolean(process.env.SENTRY_DSN),
      ai: Boolean(process.env.OPENAI_API_KEY),
      whatsapp: Boolean(process.env.WHATSAPP_CLOUD_API_TOKEN),
      razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
    },
    metrics: {
      orders24h: orders24h ?? 0,
      revenue24h,
      behavior24h: behavior24h ?? 0,
      webhook24h: webhook24h ?? 0,
      pendingNotifications: pendingNotifications ?? 0,
      failedNotifications: failedNotifications ?? 0
    },
    events
  });
});

