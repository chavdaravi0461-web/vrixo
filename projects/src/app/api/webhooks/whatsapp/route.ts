import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { publishEvent } from "@/lib/event-bus";
import { logInfo } from "@/lib/observability";
import { securityLog } from "@/lib/security";
import { saveWhatsAppLog } from "@/services/notifications/whatsapp-log-store";
import { safeRoute } from "@/lib/safe-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const metaVerifyQuerySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1).max(512),
  "hub.challenge": z.string().min(1).max(4096)
});

function trace(event: string, details?: Record<string, unknown>) {
  console.log(`[TRACE] ${event}`, details ?? {});
}

function timingSafeEqualString(provided: string, expected: string) {
  if (!provided || !expected) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) {
      crypto.timingSafeEqual(a, a);
      return false;
    }
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function getVerifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
}

function getWebhookSecret() {
  return process.env.WHATSAPP_WEBHOOK_SECRET?.trim() ?? "";
}

function getAppSecretFallback() {
  return process.env.META_APP_SECRET?.trim() ?? "";
}

function collectSigningSecrets(): Array<{ key: string; label: string }> {
  const secrets: Array<{ key: string; label: string }> = [];

  const webhookSecret = getWebhookSecret();
  if (webhookSecret) {
    secrets.push({ key: webhookSecret, label: "WHATSAPP_WEBHOOK_SECRET" });
  }

  const appSecret = getAppSecretFallback();
  if (appSecret) {
    secrets.push({ key: appSecret, label: "META_APP_SECRET" });
  }

  return secrets;
}

async function verifySignatureAny(
  rawBody: string,
  signatureHeader?: string | null
): Promise<{ ok: boolean; detail: string }> {
  if (!signatureHeader) {
    return { ok: false, detail: "x-hub-signature-256 header is missing" };
  }

  const prefix = "sha256=";
  const expected = signatureHeader.startsWith(prefix)
    ? signatureHeader.slice(prefix.length)
    : signatureHeader;

  const secrets = collectSigningSecrets();
  if (secrets.length === 0) {
    return { ok: false, detail: "Meta App Secret is not configured" };
  }

  for (const { key, label: keyLabel } of secrets) {
    const hash = crypto.createHmac("sha256", key).update(rawBody).digest("hex");
    if (timingSafeEqualString(hash, expected)) {
      return { ok: true, detail: keyLabel };
    }
  }

  return { ok: false, detail: "Signature did not match the configured Meta App Secret" };
}

export async function GET(request: Request) {
  try {
    const configuredToken = getVerifyToken();

    if (!configuredToken) {
      securityLog("whatsapp.webhook.verify_not_configured");
      logInfo("whatsapp.webhook.verify_skipped", { reason: "missing_WHATSAPP_VERIFY_TOKEN" });
      return NextResponse.json(
        { message: "WhatsApp webhook verification is not configured." },
        { status: 503 }
      );
    }

    const url = new URL(request.url);
    const query = {
      "hub.mode": url.searchParams.get("hub.mode") ?? "",
      "hub.verify_token": url.searchParams.get("hub.verify_token") ?? "",
      "hub.challenge": url.searchParams.get("hub.challenge") ?? ""
    };

    const parsed = metaVerifyQuerySchema.safeParse(query);

    if (!parsed.success) {
      securityLog("whatsapp.webhook.verify_malformed", {
        hasMode: Boolean(query["hub.mode"]),
        hasToken: Boolean(query["hub.verify_token"]),
        hasChallenge: Boolean(query["hub.challenge"])
      });
      return NextResponse.json(
        { message: "Invalid webhook verification request." },
        { status: 400 }
      );
    }

    const {
      "hub.verify_token": verifyToken,
      "hub.challenge": challenge
    } = parsed.data;

    if (!timingSafeEqualString(verifyToken, configuredToken)) {
      securityLog("whatsapp.webhook.verify_token_rejected");
      logInfo("whatsapp.webhook.verify_failed", { reason: "token_mismatch" });
      void publishEvent({
        type: "webhook.verification_failed",
        severity: "warn",
        entityType: "whatsapp",
        payload: { channel: "meta_get" }
      }).catch(() => undefined);
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    securityLog("whatsapp.webhook.verify_accepted");
    logInfo("whatsapp.webhook.verify_succeeded");
    void publishEvent({
      type: "webhook.verified",
      severity: "info",
      entityType: "whatsapp",
      payload: { channel: "meta_get" }
    }).catch(() => undefined);

    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  } catch (error) {
    securityLog("whatsapp.webhook.verify_error", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { message: "Webhook verification could not be completed." },
      { status: 500 }
    );
  }
}

export const POST = safeRoute(async function POST(request: Request) {
  trace("WEBHOOK_RECEIVED", { route: "/api/webhooks/whatsapp" });
  console.log("[WEBHOOK] WEBHOOK_RECEIVED â€” POST /api/webhooks/whatsapp");

  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  console.log("[WEBHOOK] WEBHOOK_RECEIVED â€” details", {
    bodyLength: rawBody.length,
    bodyPreview: rawBody.slice(0, 200),
    hasSignature: Boolean(signature),
    signaturePrefix: signature ? signature.slice(0, 20) : "none",
    secretsConfigured: collectSigningSecrets().map((s) => s.label),
    OPENAI_API_KEY_present: Boolean(process.env.OPENAI_API_KEY),
    GROQ_API_KEY_present: Boolean(process.env.GROQ_API_KEY),
  });
  trace("WEBHOOK_RECEIVED", {
    bodyLength: rawBody.length,
    hasSignature: Boolean(signature),
    hasGroq: Boolean(process.env.GROQ_API_KEY),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
  });

  const { ok, detail } = await verifySignatureAny(rawBody, signature);

  if (!ok) {
    console.log("[whatsapp-webhook] 401 â€” signature verification failed", { detail });

    securityLog("whatsapp.webhook.signature_rejected", {
      hasSignatureHeader: Boolean(signature),
      hasWebhookSecret: Boolean(getWebhookSecret()),
      bodyLength: rawBody.length,
      detail,
    });

    return NextResponse.json(
      {
        message: "Invalid signature",
        detail
      },
      { status: 401 }
    );
  }

  console.log("[whatsapp-webhook] signature PASSED â€”", detail);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  console.log("[whatsapp-webhook] payload parsed", {
    entryCount: Array.isArray(payload.entry) ? payload.entry.length : 0,
    hasStatuses: Boolean(payload.entry?.[0]?.changes?.[0]?.value?.statuses),
    hasMessages: Boolean(payload.entry?.[0]?.changes?.[0]?.value?.messages),
  });

  const adminSupabase = createAdminClient();
  await publishEvent({
    type: "webhook.received",
    severity: "info",
    entityType: "whatsapp",
    payload: { signature: Boolean(signature) }
  });

  try {
    const statuses: any[] = [];
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value || {};

        const messagesArr = value.messages || [];
        for (const m of messagesArr) {
          const fromPhone = String(m.from ?? "");
          const hasText = Boolean(m.text?.body);
          const hasInteractive = Boolean(m.interactive?.button_reply);
          const hasOrderDetails = Boolean(m.order?.catalog_id);

          if (hasInteractive) {
            const buttonId = String(m.interactive.button_reply.id ?? "");
            const buttonTitle = String(m.interactive.button_reply.title ?? "");
            logInfo("whatsapp.webhook.button_pressed", { fromSuffix: fromPhone.slice(-4), buttonId, buttonTitle, messageId: m.id });

            try {
              const { handleNeedHelp, handleCancelOrder, handleReturnOrder } = await import("@/lib/whatsapp/button-handlers");
              const { getCustomerFromWhatsApp } = await import("@/lib/whatsapp/customer-context");
              const ctx = await getCustomerFromWhatsApp(fromPhone);

              if (buttonId === "need_help" || buttonId === "contact_support") {
                const result = await handleNeedHelp(fromPhone, ctx?.name ?? null);
                logInfo("whatsapp.webhook.need_help_result", { success: result.success, messageId: m.id });
              } else if (buttonId.startsWith("cancel_")) {
                const orderNo = buttonId.replace("cancel_", "");
                const result = await handleCancelOrder(fromPhone, orderNo);
                logInfo("whatsapp.webhook.cancel_result", { success: result.success, orderNumber: orderNo, messageId: m.id });
              } else if (buttonId.startsWith("return_")) {
                const orderNo = buttonId.replace("return_", "");
                const result = await handleReturnOrder(fromPhone, orderNo, "Customer requested return via WhatsApp button");
                logInfo("whatsapp.webhook.return_result", { success: result.success, orderNumber: orderNo, messageId: m.id });
              }
            } catch (btnErr) {
              console.error("[whatsapp-webhook] button handler error", btnErr);
            }
          } else if (hasOrderDetails) {
            logInfo("whatsapp.webhook.order_message", { fromSuffix: fromPhone.slice(-4), messageId: m.id });
          } else if (hasText) {
            const text = String(m.text.body ?? "").toLowerCase().trim();
            logInfo("whatsapp.webhook.text_message", { fromSuffix: fromPhone.slice(-4), text: text.slice(0, 100), messageId: m.id });
          }
        }

        const statusesArr = value.statuses || [];
        for (const s of statusesArr) {
          statuses.push(s);
          const messageId = s.id;
          const status = s.status;
          const recipient = s.recipient_id;

          console.log("[whatsapp-webhook] status update", { messageId, status, recipient });

          const { data: notification } = await adminSupabase
            .from("order_notifications")
            .select("id, order_id, attempts, max_attempts")
            .eq("provider_message_id", messageId)
            .maybeSingle();
          const orderRef = notification?.order_id ?? null;
          const failedError = status === "failed"
            ? extractMetaStatusError(s)
            : null;

          if (notification?.id) {
            const notificationUpdates: Record<string, unknown> = {
              delivery_status: status,
              provider_response: s,
              last_error: failedError,
              updated_at: new Date().toISOString()
            };
            if (status === "delivered") notificationUpdates.delivered_at = new Date().toISOString();
            if (status === "read") notificationUpdates.read_at = new Date().toISOString();
            if (status === "failed") {
              const exhausted = Number(notification.attempts ?? 0) >= Number(notification.max_attempts ?? 8);
              notificationUpdates.status = exhausted ? "failed" : "retry_scheduled";
              notificationUpdates.next_retry_at = exhausted
                ? null
                : new Date(Date.now() + 60_000).toISOString();
            }

            await adminSupabase
              .from("order_notifications")
              .update(notificationUpdates)
              .eq("id", notification.id);
          }

          if (orderRef) {
            await adminSupabase
              .from("orders")
              .update({
                whatsapp_status: status,
                whatsapp_error: failedError
              })
              .eq("id", orderRef);
          }

          await saveWhatsAppLog({
            orderId: orderRef ?? String(recipient ?? messageId ?? "unknown"),
            channel: "webhook_status",
            attempt: 0,
            status: status === "failed" ? "failed" : "sent",
            messageId,
            error: failedError ?? undefined,
            response: s
          });
          await publishEvent({
            type: "whatsapp.event",
            severity: status === "failed" ? "warn" : "info",
            entityId: orderRef ?? String(recipient ?? ""),
            entityType: "whatsapp",
            payload: { status, recipient, providerMessageId: messageId }
          });
        }
      }
    }

    console.log("[whatsapp-webhook] done", { statusCount: statuses.length });

    return NextResponse.json({ ok: true, processed: statuses.length });
  } catch (err) {
    console.error("[whatsapp-webhook] processing error", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
});

function extractMetaStatusError(status: Record<string, any>) {
  const error = Array.isArray(status.errors) ? status.errors[0] : null;
  if (!error) return "WhatsApp delivery failed.";
  return String(error.title ?? error.message ?? error.error_data?.details ?? "WhatsApp delivery failed.");
}
