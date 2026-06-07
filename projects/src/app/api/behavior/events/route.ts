import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { trackBehaviorEvent } from "@/services/behavior/customer-intelligence";
import { safeRoute } from "@/lib/safe-route";

const behaviorEventSchema = z.object({
  sessionId: z.string().trim().min(8).max(160),
  eventType: z.enum(["page_view", "product_view", "add_to_cart", "checkout_start", "payment_start", "purchase", "search", "support_open"]),
  path: z.string().trim().max(500).optional(),
  productId: z.string().uuid().optional(),
  category: z.string().trim().max(120).optional(),
  value: z.number().finite().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const POST = safeRoute(async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, { key: "behavior-events", limit: 180, windowMs: 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const parsed = behaviorEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Invalid behavior event." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  await trackBehaviorEvent({
    ...parsed.data,
    userId: user?.id ?? null,
    path: parsed.data.path ?? new URL(request.url).pathname,
    metadata: {
      ...(parsed.data.metadata ?? {}),
      userAgent: request.headers.get("user-agent") ?? "",
      ipHash: await hashIp(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "")
    }
  });

  return NextResponse.json({ ok: true });
});

async function hashIp(value: string) {
  if (!value) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

