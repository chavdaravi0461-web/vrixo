export type OrderStatusView = {
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  isOnlinePayment: boolean;
  isPaidOnlinePayment: boolean;
  isPaymentPending: boolean;
  isCodPending: boolean;
  isPendingState: boolean;
  displayPaymentMethod: string;
  displayPaymentStatus: string;
  displayOrderStatus: string;
};

export function buildOrderStatusView(input: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  orderStatus?: string | null;
}) {
  const paymentMethod = String(input.paymentMethod ?? "cod");
  const orderStatus = String(input.orderStatus ?? "pending");
  const paymentStatus = String(input.paymentStatus ?? "pending");
  const normalizedPaymentStatus = paymentStatus.toLowerCase();
  const normalizedOrderStatus = orderStatus.toLowerCase();
  const normalizedPaymentMethod = paymentMethod.toLowerCase();
  const isOnlinePayment =
    normalizedPaymentMethod === "online" || normalizedPaymentMethod === "online payment";
  const isPaidOnlinePayment = isOnlinePayment && normalizedPaymentStatus === "paid";
  const isPaymentPending = isOnlinePayment && normalizedPaymentStatus === "pending";
  const isCodPending =
    !isOnlinePayment &&
    (normalizedOrderStatus === "pending" || normalizedPaymentStatus === "cod_pending");

  return {
    paymentMethod,
    paymentStatus,
    orderStatus,
    isOnlinePayment,
    isPaidOnlinePayment,
    isPaymentPending,
    isCodPending,
    isPendingState: isPaymentPending || isCodPending,
    displayPaymentMethod: isOnlinePayment ? "Online Payment" : "Cash on Delivery",
    displayPaymentStatus:
      !isOnlinePayment && normalizedPaymentStatus === "cod_pending"
        ? "Cash on Delivery (Pending)"
        : paymentStatus,
    displayOrderStatus: isPaidOnlinePayment
      ? "Order Confirmed"
      : isCodPending
        ? "Order Placed (COD)"
        : normalizedOrderStatus === "confirmed"
          ? "Order Confirmed"
          : orderStatus
  } satisfies OrderStatusView;
}
