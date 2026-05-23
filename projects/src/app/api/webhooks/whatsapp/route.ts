import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectMongo, WhatsAppAttempt } from "@/lib/mongo/models";
import { publishEvent } from "@/lib/event-bus";
import { logInfo } from "@/lib/observability";
import { securityLog } from "@/lib/security";

const metaVerifyQuerySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1).max(512),
  "hub.challenge": z.string().min(1).max(4096)
});

function timingSafeEqualString(provided: string, expected: string) {
  if (!provided || !expected) return false;

  try {
    const providedBuffer = Buffer.from(provided);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) {
      crypto.timingSafeEqual(providedBuffer, providedBuffer);
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function getWhatsAppVerifyToken() {
  return process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
}

function getWhatsAppWebhookSecret() {
  return process.env.WHATSAPP_WEBHOOK_SECRET?.trim() ?? "";
}

async function verifySignature(rawBody: string, signatureHeader?: string | null) {
  const secret = getWhatsAppWebhookSecret();
  if (!secret) return true;
  if (!signatureHeader) return false;

  try {
    const hash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    // header expected format: sha256=...
    const expected = signatureHeader.split("=")[1] ?? signatureHeader;
    return timingSafeEqualString(hash, expected);
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const configuredToken = getWhatsAppVerifyToken();

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

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!(await verifySignature(rawBody, signature))) {
    securityLog("whatsapp.webhook.signature_rejected", {
      hasSignatureHeader: Boolean(signature),
      hasWebhookSecret: Boolean(getWhatsAppWebhookSecret())
    });
    return NextResponse.json({ message: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  // WhatsApp webhook structure: entry[].changes[].value.messages or statuses
  try {
    await connectMongo();
  } catch (err) {
    console.warn("[whatsapp-webhook] mongo connect failed", err);
  }

  const adminSupabase = createAdminClient();
  await publishEvent({
    type: "webhook.received",
    severity: "info",
    entityType: "whatsapp",
    payload: { signature: Boolean(signature) }
  });

  // import AI support handler lazily to avoid cold-start penalties
  const { handleWhatsAppSupportMessage } = await import("@/lib/ai/support");

  try {
    const statuses = [] as any[];
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value || {};
        // handle message receives
        const messagesArr = value.messages || [];
        for (const m of messagesArr) {
          try {
            // message structure: from, text.body
            const from = m.from;
            const text = m.text?.body || m.broadcast || "";
            if (text) {
              void handleWhatsAppSupportMessage({ from, text }).catch((supportError) => {
                console.warn("[whatsapp-webhook] support handler failed", supportError);
              });
              await publishEvent({
                type: "support.message",
                severity: "info",
                entityId: from,
                entityType: "whatsapp",
                payload: { from, textLength: text.length }
              });
            }
          } catch {
            console.warn("[whatsapp-webhook] message process failed");
          }
        }

        const statusesArr = value.statuses || [];
        for (const s of statusesArr) {
          statuses.push(s);
          // s has fields: id, status, recipient_id, conversation, timestamp
          const messageId = s.id;
          const status = s.status;
          const recipient = s.recipient_id;
          const orderRef =
            s?.recipient?.orderId ||
            s?.metadata?.orderId ||
            s?.metadata?.order_number ||
            s?.metadata?.orderNumber ||
            null;

          if (orderRef) {
            await adminSupabase
              .from("orders")
              .update({ whatsapp_status: status, whatsapp_error: status === "failed" ? "delivered_failed" : null })
              .eq("id", orderRef);
          }

          try {
            await WhatsAppAttempt.create({ orderId: orderRef ?? String(recipient ?? ""), attempt: 0, status: status, response: s });
            await publishEvent({
              type: "whatsapp.event",
              severity: status === "failed" ? "warn" : "info",
              entityId: orderRef ?? String(recipient ?? ""),
              entityType: "whatsapp",
              payload: { status, recipient, providerMessageId: messageId }
            });
          } catch {
            // ignore
          }
        }
      }
    }

    return NextResponse.json({ ok: true, processed: statuses.length });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
