import { cancelCustomerOrder, syncMyOrdersPage, type CustomerOrderDetailed } from "@/lib/whatsapp/customer-context";
import { recordOrderDiscussed, recordIssue, resolveIssue } from "@/lib/order-intelligence/commerce-memory";
import { invalidateCustomerCache } from "@/lib/data-consistency";

export type CancelResult = {
  success: boolean;
  error?: string;
  order?: CustomerOrderDetailed;
  message: string;
};

export async function executeCancel(
  phone: string,
  orderNumber: string,
  reason?: string,
): Promise<CancelResult> {
  const result = await cancelCustomerOrder(orderNumber, phone, reason);

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      message: result.error ?? "Unable to cancel order",
    };
  }

  const digits = phone.replace(/\D/g, "");

  // Sync cache immediately
  await invalidateCustomerCache(digits);

  // Re-fetch fresh context
  await syncMyOrdersPage(phone);

  // Record in commerce memory
  await recordOrderDiscussed(phone, orderNumber);
  await recordIssue(phone, `Cancelled order #${orderNumber}${reason ? ` — ${reason}` : ""}`);
  await resolveIssue(phone, `Cancelled order #${orderNumber}`);

  return {
    success: true,
    order: result.order,
    message: `Order #${orderNumber} has been cancelled successfully.`,
  };
}
