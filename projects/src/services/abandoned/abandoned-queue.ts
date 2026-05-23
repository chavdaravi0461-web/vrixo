import { createQueue } from "@/lib/queue";

type AbandonedJob = {
  orderId?: string;
  orderNumber?: string;
  customerName: string;
  customerPhone: string;
  items: Array<Record<string, unknown>>;
  total: number;
  checkoutLink: string;
  deliveryAddress?: string;
};

const queue = createQueue("whatsapp-jobs");

export async function enqueueAbandonedJob(payload: AbandonedJob) {
  await queue.add("abandoned-cart", payload, { attempts: 3, backoff: { type: "exponential", delay: 5 * 60 * 1000 } });
}
