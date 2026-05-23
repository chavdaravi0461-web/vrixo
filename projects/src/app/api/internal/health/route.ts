import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRedis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = request.headers.get("x-internal-token");
  const required = process.env.INTERNAL_API_TOKEN;

  if (required && token !== required) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const [redis, database] = await Promise.all([
    withRedis(async (client) => (await client.ping()) === "PONG", false),
    checkDatabase()
  ]);

  const status = redis && database ? "ok" : "degraded";

  return NextResponse.json({
    status,
    services: {
      database,
      redis,
      sentry: Boolean(process.env.SENTRY_DSN),
      ai: Boolean(process.env.OPENAI_API_KEY)
    },
    checkedAt: new Date().toISOString()
  }, { status: status === "ok" ? 200 : 503 });
}

async function checkDatabase() {
  try {
    const result = await createAdminClient().from("orders").select("id", { count: "exact", head: true }).limit(1);
    return !result.error;
  } catch {
    return false;
  }
}
