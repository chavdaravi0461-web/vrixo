import { NextResponse } from "next/server";
import { z } from "zod";
import { handleWebChatMessage } from "@/lib/ai/support";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { trackBehaviorEvent } from "@/services/behavior/customer-intelligence";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  sessionId: z.string().trim().min(8).max(160).optional()
});

export async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "support-chat",
    limit: 30,
    windowMs: 10 * 60 * 1000
  });

  if (!rateLimit.allowed) {
    return tooManyRequests(rateLimit.retryAfter);
  }

  const parsed = chatSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid chat message." },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  try {
    const result = await handleWebChatMessage({
      userId: user?.id,
      message: parsed.data.message
    });

    void trackBehaviorEvent({
      sessionId: parsed.data.sessionId ?? user?.id ?? "support-chat",
      eventType: "support_open",
      userId: user?.id ?? null,
      path: "/support/chat",
      metadata: { channel: "web_widget" }
    }).catch(() => undefined);

    return NextResponse.json({ reply: result.reply });
  } catch {
    return NextResponse.json(
      { message: "AI support could not respond right now. Please try again shortly." },
      { status: 500 }
    );
  }
}
