import { createQueue } from "@/lib/queue";
import { logInfo } from "@/lib/observability";

export type WhatsAppJobPayload = {
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
};

const queue = createQueue("whatsapp-jobs");

export async function enqueueWhatsAppJob(payload: WhatsAppJobPayload, opts?: { attempts?: number; delay?: number }) {
  const attempts = opts?.attempts ?? 5;
  const delay = opts?.delay ?? 0;

  logInfo("whatsapp_queue.enqueue", {
    orderId: payload.orderId,
    orderNumber: payload.orderNumber,
    attempts,
    delay
  });

  await queue.add("send-order-whatsapp", payload, {
    jobId: `order-whatsapp:${payload.orderId}`,
    attempts,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: 200,
    delay
  });
}
