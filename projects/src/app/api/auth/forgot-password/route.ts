import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { hasEmailEnv } from "@/lib/email";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local.slice(-1)}@${domain}`;
}

export async function POST(request: NextRequest) {
  try {
    const rateLimit = await checkServerRateLimit(request, { key: "forgot-password", limit: 5, windowMs: 10 * 60 * 1000 });
    if (!rateLimit.allowed) {
      return NextResponse.json({ message: "Too many requests. Try again later." }, { status: 429 });
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const supabase = createAdminClient();

    // Lookup profile by email
    const { data: profile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, email, phone, contact_preference, name")
      .eq("email", email)
      .single();

    // Always return success to prevent email enumeration
    if (lookupError || !profile) {
      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
        channels: null
      });
    }

    // Determine available channels
    const emailEnv = hasEmailEnv();
    const hasEmail = emailEnv && Boolean(profile.email);
    if (!hasEmail) {
      return NextResponse.json({
        message: "If an account exists with this email, you will receive a password reset link.",
        channels: null
      });
    }

    // Email only — send reset link directly
    // NOTE: Do NOT return userId or name — prevents account enumeration
    return NextResponse.json({
      message: "If an account exists with this email, you will receive a password reset link.",
      channels: [{ channel: "email" as const, label: "Email", detail: maskEmail(profile.email), recommended: true }],
    });
  } catch (err) {
    console.error("[forgot-password]", JSON.stringify({ message: "unhandled_error", error: err instanceof Error ? err.message : String(err) }));
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
