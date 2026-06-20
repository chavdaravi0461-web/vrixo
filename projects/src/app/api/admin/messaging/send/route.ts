import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasEmailEnv, sendEmail } from "@/lib/email";
import { safeRoute } from "@/lib/safe-route";
import { tooManyRequests } from "@/lib/api-response";
import { checkServerRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const sendSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  body: z.string().trim().min(1, "Message body is required.").max(5000),
  recipientMode: z.enum(["all", "newsletter", "selected"]),
  selectedIds: z.array(z.string().uuid()).optional().default([]),
});

export const POST = safeRoute(async function POST(request: Request) {
  const admin = await requireAdmin();

  const rateLimit = await checkServerRateLimit(request, { key: "messaging-send", limit: 5, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  if (!hasEmailEnv()) {
    return NextResponse.json(
      { message: "Email service is not configured. Please set RESEND_API_KEY." },
      { status: 500 }
    );
  }

  const parsed = sendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { subject, body, recipientMode, selectedIds } = parsed.data;
  const supabase = createAdminClient();

  let emails: string[] = [];

  if (recipientMode === "all") {
    const { data } = await supabase
      .from("profiles")
      .select("email")
      .not("email", "is", null)
      .neq("email", "");
    emails = (data ?? []).map((p) => p.email).filter(Boolean) as string[];
  } else if (recipientMode === "newsletter") {
    const { data } = await supabase
      .from("newsletter_subscriptions")
      .select("email");
    emails = (data ?? []).map((s) => s.email).filter(Boolean) as string[];
  } else if (recipientMode === "selected" && selectedIds.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("email")
      .in("id", selectedIds)
      .not("email", "is", null)
      .neq("email", "");
    emails = (data ?? []).map((p) => p.email).filter(Boolean) as string[];
  }

  const uniqueEmails = [...new Set(emails.map((e) => e.trim().toLowerCase()))];

  if (uniqueEmails.length === 0) {
    return NextResponse.json(
      { message: "No valid recipient emails found." },
      { status: 400 }
    );
  }

  const emailHtml = buildEmailHtml(subject, body);

  let sentCount = 0;
  let failedCount = 0;

  const batchSize = 10;
  for (let i = 0; i < uniqueEmails.length; i += batchSize) {
    const batch = uniqueEmails.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((email) =>
        sendEmail({ to: email, subject, html: emailHtml })
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value.sent) {
        sentCount++;
      } else {
        failedCount++;
      }
    }
  }

  await supabase.from("customer_messages").insert({
    subject,
    body,
    recipient_mode: recipientMode,
    recipient_count: uniqueEmails.length,
    sent_count: sentCount,
    failed_count: failedCount,
    sent_by: admin.profile.email ?? "admin",
    selected_ids: recipientMode === "selected" ? selectedIds : null,
  });

  return NextResponse.json({
    message: `Message sent to ${sentCount} recipients${failedCount > 0 ? ` (${failedCount} failed)` : ""}.`,
    sentCount,
    failedCount,
    totalRecipients: uniqueEmails.length,
  });
});

function buildEmailHtml(subject: string, body: string): string {
  const escapedBody = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#030308;font-family:'Inter',system-ui,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;padding:10px 14px;">
        <span style="color:#fff;font-weight:700;font-size:16px;letter-spacing:-0.02em;">Vrixo</span>
      </div>
    </div>
    <div style="background:#0a0a12;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:32px;">
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0 0 16px;letter-spacing:-0.02em;">${subject}</h1>
      <div style="color:#a0a0b0;font-size:15px;line-height:1.7;">${escapedBody}</div>
    </div>
    <div style="text-align:center;margin-top:24px;">
      <p style="color:#505060;font-size:12px;">Sent from Vrixo Commerce OS</p>
    </div>
  </div>
</body>
</html>`;
}
