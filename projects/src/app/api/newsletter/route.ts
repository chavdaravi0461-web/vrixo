import { NextResponse } from "next/server";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const rateLimit = await checkServerRateLimit(request, { key: "newsletter", limit: 8, windowMs: 10 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }

    const body = (await request.json()) as { email?: string };

    if (!body.email || !body.email.trim()) {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email.trim())) {
      return NextResponse.json({ message: "Please enter a valid email." }, { status: 400 });
    }

    if (!hasServerSupabaseAdminEnv()) {
      return NextResponse.json({ message: "Newsletter signup is temporarily unavailable." }, { status: 500 });
    }

    const email = body.email.trim().toLowerCase();
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("newsletter_subscriptions")
      .upsert({ email }, { onConflict: "email" });

    if (error) {
      console.error("[newsletter]", JSON.stringify({ message: "supabase_upsert_error", error: error.message, code: error.code, details: error.details }));
      return NextResponse.json({ message: "Newsletter signup failed. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ message: "Subscribed successfully!" });
  } catch (err) {
    console.error("[newsletter]", JSON.stringify({ message: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
