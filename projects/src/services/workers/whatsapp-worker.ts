import { createWorker } from "@/lib/queue";
import { isRedisAvailable } from "@/lib/redis";
import {
  sendWhatsAppDocumentMessage,
  getWhatsAppServerEnv,
  formatWhatsAppPhone,
  sendOrderConfirmationWhatsApp
} from "@/lib/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAIResponse } from "@/lib/ai/provider";
import { dispatchOrderConfirmationWhatsApp } from "@/services/notifications/order-whatsapp";
import { logInfo, logError } from "@/lib/observability";
import { saveWhatsAppLog } from "@/services/notifications/whatsapp-log-store";
import type { Job } from "bullmq";

type JobPayload = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  productNames: string;
  totalQty: number;
  totalAmount: number;
  orderStatus: string;
  paymentMethod?: "cod" | "online";
  paymentStatus?: string;
  productImageUrl?: string;
  deliveryAddress?: string;
  items?: Array<{ title?: string; quantity?: number; image?: string }>;
  total?: number;
  checkoutLink?: string;
};

async function processJob(job: Job<JobPayload> | { name?: string; id?: string; attemptsMade?: number; data: JobPayload }) {
  const name = job.name || "";
  const payload = job.data;
  const supabase = createAdminClient();
  const attempt = Number(job.attemptsMade ?? 0) + 1;

  logInfo("whatsapp_worker.job_started", {
    jobName: name,
    jobId: job.id,
    attempt,
    orderId: payload.orderId,
    orderNumber: payload.orderNumber
  });

  try {
    if (name === "send-invoice") {
      const { generateInvoicePdfBuffer, uploadInvoiceToS3 } = await import("@/services/invoice/invoice");
      const buffer = await generateInvoicePdfBuffer({
        orderNumber: payload.orderNumber,
        customerName: payload.customerName,
        items: (payload.items ?? []) as Array<{ title: string; quantity: number; price: number }>,
        total: payload.total ?? 0,
        issuedAt: new Date().toISOString()
      });
      const key = `invoices/${payload.orderNumber}.pdf`;
      const url = await uploadInvoiceToS3(buffer, key);
      const env = getWhatsAppServerEnv();

      await sendWhatsAppDocumentMessage({
        to: formatWhatsAppPhone(payload.customerPhone),
        documentUrl: url,
        filename: `${payload.orderNumber}.pdf`,
        token: env.WHATSAPP_CLOUD_API_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID
      });

      await supabase.from("orders").update({ invoice_url: url }).eq("id", payload.orderId);
      await saveWhatsAppLog({
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        jobId: job.id,
        channel: "invoice",
        attempt,
        status: "sent",
        response: { invoiceUrl: url }
      });
      logInfo("whatsapp_worker.invoice_sent", { orderId: payload.orderId });
      return { sent: true };
    }

    if (name === "abandoned-cart") {
      const prompt = `Generate a short luxury-branded recovery WhatsApp message for ${payload.customerName} who left ${payload.items?.map((item) => item.title).join(", ")} in cart. Include a checkout link: ${payload.checkoutLink} and a limited-time discount.`;
      const message =
        (await generateAIResponse(prompt)) || "Your cart is waiting. Tap to complete checkout now.";

      const abandonedResult = await sendOrderConfirmationWhatsApp({
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        orderNumber: payload.orderNumber ?? "",
        productNames: payload.items?.map((item) => item.title).join(", ") || "",
        totalQty: payload.items?.reduce((sum, item) => sum + Number(item.quantity || 1), 0) || 0,
        totalAmount: payload.total || 0,
        orderStatus: "abandoned_cart",
        paymentMethod: "online",
        paymentStatus: "pending",
        productImageUrl: payload.items?.[0]?.image || "",
        deliveryAddress: payload.deliveryAddress || ""
      });

      await saveWhatsAppLog({
        orderId: payload.orderId ?? "",
        orderNumber: payload.orderNumber,
        jobId: job.id,
        channel: "abandoned_cart",
        attempt,
        status: abandonedResult.sent ? "sent" : "failed",
        messageId: abandonedResult.customerMessageId,
        adminMessageId: abandonedResult.adminMessageId,
        error: abandonedResult.error ?? undefined,
        response: { message, result: abandonedResult }
      });
      logInfo("whatsapp_worker.abandoned_cart_sent", { orderId: payload.orderId });
      return { sent: true };
    }

    const paymentMethod = payload.paymentMethod ?? inferPaymentMethod(payload.orderStatus);
    const paymentStatus = payload.paymentStatus ?? inferPaymentStatus(payload.orderStatus);

    const result = await dispatchOrderConfirmationWhatsApp({
      orderId: payload.orderId,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      orderNumber: payload.orderNumber,
      productNames: payload.productNames,
      totalQty: payload.totalQty,
      totalAmount: payload.totalAmount,
      orderStatus: payload.orderStatus,
      paymentMethod,
      paymentStatus,
      productImageUrl: payload.productImageUrl ?? "",
      deliveryAddress: payload.deliveryAddress ?? ""
    }, {
      jobId: job.id,
      attempt
    });

    if (!result.sent && !result.skipped) {
      throw new Error(result.error || "WhatsApp delivery failed.");
    }

    return result;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logError("whatsapp_worker.job_failed", {
      orderId: payload.orderId,
      jobName: name,
      error: errorMessage
    });

    await supabase
      .from("orders")
      .update({ whatsapp_status: "failed", whatsapp_error: errorMessage, last_error: errorMessage })
      .eq("id", payload.orderId);

    await saveWhatsAppLog({
      orderId: payload.orderId ?? "",
      orderNumber: payload.orderNumber,
      jobId: job.id,
      channel: name || "order_confirmation",
      attempt,
      status: "error",
      error: errorMessage
    });

    throw err;
  }
}

function inferPaymentMethod(orderStatus: string): "cod" | "online" {
  const normalized = orderStatus.toLowerCase();
  if (normalized.includes("cod") || normalized === "pending") return "cod";
  return "online";
}

function inferPaymentStatus(orderStatus: string) {
  const normalized = orderStatus.toLowerCase();
  if (normalized.includes("confirm") || normalized === "paid") return "paid";
  if (normalized.includes("cod")) return "cod_pending";
  return "pending";
}

let workerInitialized = false;

export function startWhatsAppWorker() {
  if (workerInitialized) {
    logInfo("whatsapp_worker.already_initialized");
    return;
  }
  if (!isRedisAvailable()) {
    logInfo("whatsapp_worker.skipped", { reason: "redis_unavailable" });
    return;
  }
  workerInitialized = true;
  logInfo("whatsapp_worker.starting");
  createWorker<JobPayload>("whatsapp-jobs", async (job) => processJob(job));
}

const shouldStartWorker =
  process.env.START_WORKER === "true" ||
  (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== undefined);

if (shouldStartWorker && isRedisAvailable()) {
  startWhatsAppWorker();
} else if (shouldStartWorker) {
  logInfo("whatsapp_worker.skipped_at_startup", { reason: "redis_unavailable" });
}
