import { createWorker } from "@/lib/queue";
import {
  sendWhatsAppDocumentMessage,
  getWhatsAppServerEnv,
  formatWhatsAppPhone,
  sendOrderConfirmationWhatsApp
} from "@/lib/whatsapp";
import { createAdminClient } from "@/lib/supabase/admin";
import { connectMongo, WhatsAppAttempt } from "@/lib/mongo/models";
import { generateAIResponse } from "@/lib/ai/provider";
import { dispatchOrderConfirmationWhatsApp } from "@/services/notifications/order-whatsapp";

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

async function processJob(job: { name?: string; data: JobPayload }) {
  const name = job.name || "";
  const payload = job.data;
  const supabase = createAdminClient();

  try {
    await connectMongo();
  } catch (err) {
    console.warn("[whatsapp-worker] could not connect to mongo for logging", err);
  }

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
      await WhatsAppAttempt.create({ orderId: payload.orderId, attempt: 1, status: "sent", response: { invoiceUrl: url } });
      return { sent: true };
    }

    if (name === "abandoned-cart") {
      const prompt = `Generate a short luxury-branded recovery WhatsApp message for ${payload.customerName} who left ${payload.items?.map((item) => item.title).join(", ")} in cart. Include a checkout link: ${payload.checkoutLink} and a limited-time discount.`;
      const message =
        (await generateAIResponse(prompt)) || "Your cart is waiting. Tap to complete checkout now.";

      await sendOrderConfirmationWhatsApp({
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

      await WhatsAppAttempt.create({ orderId: payload.orderId ?? "", attempt: 1, status: "sent", response: { message } });
      return { sent: true };
    }

    const paymentMethod = payload.paymentMethod ?? inferPaymentMethod(payload.orderStatus);
    const paymentStatus = payload.paymentStatus ?? inferPaymentStatus(payload.orderStatus);

    return dispatchOrderConfirmationWhatsApp({
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
    });
  } catch (err) {
    await supabase
      .from("orders")
      .update({
        whatsapp_status: "failed",
        whatsapp_error: err instanceof Error ? err.message : String(err)
      })
      .eq("id", payload.orderId);

    try {
      await WhatsAppAttempt.create({
        orderId: payload.orderId ?? "",
        attempt: 0,
        status: "error",
        error: err instanceof Error ? err.message : String(err)
      });
    } catch {
      // non-blocking
    }

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

createWorker("whatsapp-jobs", async (job) => processJob(job as { name?: string; data: JobPayload }));
