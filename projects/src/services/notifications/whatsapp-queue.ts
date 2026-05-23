import { createQueue } from "@/lib/queue";

type WhatsAppJobPayload = {
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

export async function enqueueWhatsAppJob(payload: WhatsAppJobPayload, opts?: { attempts?: number }) {
  const attempts = opts?.attempts ?? 5;
  // job name intentionally simple
  await queue.add("send-order-whatsapp", payload, {
    attempts,
    backoff: {
      type: "exponential",
      // initial 10 minutes expressed in ms
      delay: 10 * 60 * 1000
    },
    removeOnComplete: 100,
    removeOnFail: 100
  });
}
