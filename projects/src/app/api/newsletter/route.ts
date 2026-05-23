import { NextResponse } from "next/server";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { serverError, tooManyRequests } from "@/lib/api-response";

export async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "newsletter", limit: 8, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const body = (await request.json()) as { email?: string };

  if (!body.email) {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  if (!hasServerSupabaseAdminEnv()) {
    return serverError("Newsletter signup is temporarily unavailable.");
  }

  const email = body.email.trim().toLowerCase();
  const supabase = createAdminClient();
  const { error } = await supabase.from("newsletter_subscriptions").upsert({ email });

  await supabase.from("newsletter_subscribers").upsert({ email });

  if (error) {
    return serverError("Newsletter signup failed.");
  }

  return NextResponse.json({ message: "Subscribed successfully." });
}
