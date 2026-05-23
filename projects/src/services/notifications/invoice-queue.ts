import { createQueue } from "@/lib/queue";

type InvoiceJobPayload = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  items: Array<Record<string, unknown>>;
  total: number;
};

const queue = createQueue("invoice-jobs");

export async function enqueueInvoiceJob(payload: InvoiceJobPayload, opts?: { attempts?: number }) {
  await queue.add("send-invoice", payload, {
    attempts: opts?.attempts ?? 3,
    backoff: {
      type: "exponential",
      delay: 5 * 60 * 1000
    },
    removeOnComplete: 100,
    removeOnFail: 100
  });
}
