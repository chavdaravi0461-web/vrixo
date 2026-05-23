"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { buildOrderTrackPath } from "@/lib/safe-navigation";
import type { OrderStatusView } from "@/lib/orders/order-status";

type OrderPayload = {
  id: string;
  orderNumber: string;
  total: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  orderStatus: string | null;
  razorpayPaymentId: string | null;
  createdAt: string | null;
  customerPhone: string | null;
  customerName: string | null;
  shippingAddress: unknown;
  items: unknown;
  whatsappStatus: string | null;
  whatsappError: string | null;
  statusView: OrderStatusView;
};

type OrderSuccessViewProps = {
  orderNumber: string;
  initialOrder: OrderPayload | null;
  initialError: string | null;
  productImageUrl: string;
  productName: string;
  totalQuantity: number;
  deliveryAddress: string;
  trackingSteps: Array<{
    title: string;
    date: string;
    description: string;
    time: string;
    active: boolean;
  }>;
};

export function OrderSuccessView({
  orderNumber,
  initialOrder,
  initialError,
  productImageUrl,
  productName,
  totalQuantity,
  deliveryAddress,
  trackingSteps
}: OrderSuccessViewProps) {
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(!initialOrder && !initialError);
  const [retryingWhatsApp, setRetryingWhatsApp] = useState(false);

  const refreshOrder = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}`, {
        cache: "no-store"
      });
      const payload = (await response.json().catch(() => null)) as
        | { order?: OrderPayload; message?: string }
        | null;

      if (!response.ok || !payload?.order) {
        throw new Error(payload?.message ?? "Order not found yet. Please retry.");
      }

      setOrder(payload.order);
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to load your order right now."
      );
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (!initialOrder && !initialError) {
      const timeout = window.setTimeout(() => {
        void refreshOrder();
      }, 0);

      return () => window.clearTimeout(timeout);
    }
  }, [initialOrder, initialError, refreshOrder]);

  async function retryWhatsApp() {
    setRetryingWhatsApp(true);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/whatsapp`, {
        method: "POST"
      });
      const payload = (await response.json().catch(() => null)) as
        | { sent?: boolean; message?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.message ?? payload?.error ?? "WhatsApp retry failed.");
      }

      await refreshOrder();
    } catch (whatsappError) {
      setError(
        whatsappError instanceof Error
          ? whatsappError.message
          : "WhatsApp retry failed."
      );
    } finally {
      setRetryingWhatsApp(false);
    }
  }

  if (loading) {
    return (
      <section className="container py-16">
        <div className="mx-auto flex max-w-lg flex-col items-center rounded-[2rem] bg-white p-10 text-center card-shadow">
          <Loader2 className="h-10 w-10 animate-spin text-teal-700" />
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
            Confirming your order
          </p>
          <p className="mt-2 text-slate-600">Please wait while we load order {orderNumber}...</p>
        </div>
      </section>
    );
  }

  if (error || !order) {
    return (
      <section className="container py-16">
        <div className="mx-auto max-w-lg rounded-[2rem] bg-white p-8 text-center card-shadow">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Order lookup pending
          </p>
          <h1 className="mt-3 font-serif text-3xl font-semibold text-slate-950">
            We are syncing your order
          </h1>
          <p className="mt-3 text-slate-600">{error ?? "Order details are still being saved."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={() => void refreshOrder()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry now
            </Button>
            <Link href="/my-orders">
              <Button variant="outline">View my orders</Button>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const status = order.statusView;

  return (
    <section className="container py-10 sm:py-20">
      <div className="mx-auto max-w-2xl rounded-[2.5rem] bg-white p-6 text-center card-shadow sm:p-10">
        <CheckCircle2
          className={`mx-auto h-16 w-16 ${status.isPendingState ? "text-amber-600" : "text-green-600"}`}
        />
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
          {status.isPendingState ? "Order Placed" : "Order Confirmed"}
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold text-slate-950">
          Thank you for shopping with Vrixo
        </h1>
        <p className="mt-4 text-slate-600">
          Your order <span className="font-semibold">{order.orderNumber}</span> has been saved.
          {status.isOnlinePayment
            ? status.isPaidOnlinePayment
              ? " Payment is verified and your order is confirmed."
              : " We are confirming your online payment. Refresh if status does not update."
            : status.isCodPending
              ? " Cash on Delivery is selected. Vrixo will confirm your order before dispatch."
              : " Your order details are saved and our team will process it shortly."}
        </p>

        <div className="mt-6 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-700">
          Payment method: <span className="font-semibold">{status.displayPaymentMethod}</span>
          <br />
          Payment status: <span className="font-semibold">{status.displayPaymentStatus}</span>
          <br />
          Order status: <span className="font-semibold">{status.displayOrderStatus}</span>
          <br />
          Total: <span className="font-semibold">{formatCurrency(order.total)}</span>
          {order.razorpayPaymentId ? (
            <>
              <br />
              Razorpay payment ID: <span className="font-semibold">{order.razorpayPaymentId}</span>
            </>
          ) : null}
        </div>

        <div className="mt-4 grid gap-4 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-[1fr_12rem]">
          <div className="text-left">
            <p className="font-semibold text-slate-900">Order summary</p>
            <p className="mt-2">{productName}</p>
            <p className="mt-1">Quantity: {totalQuantity}</p>
            <p className="mt-1">Contact: {order.customerPhone || "Not provided"}</p>
            <p className="mt-1">Address: {deliveryAddress}</p>
          </div>
          <div className="relative min-h-48 overflow-hidden rounded-3xl bg-slate-100">
            <Image
              src={productImageUrl}
              alt={productName}
              fill
              sizes="(min-width: 640px) 12rem, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mt-8 text-left">
          <h2 className="font-serif text-2xl font-semibold text-slate-950">Shipping details</h2>
          <div className="mt-5">
            {trackingSteps.map((step, index) => (
              <div key={step.title} className="relative grid grid-cols-[2rem_1fr] gap-4">
                {index < trackingSteps.length - 1 ? (
                  <span
                    className={`absolute left-[0.47rem] top-4 h-full w-0.5 ${
                      step.active ? "bg-green-500" : "bg-slate-200"
                    }`}
                  />
                ) : null}
                <span
                  className={`relative z-10 mt-1 h-4 w-4 rounded-full ${
                    step.active ? "bg-green-500" : "bg-slate-300"
                  }`}
                />
                <div className="pb-6">
                  <p className="text-lg font-semibold text-slate-950">
                    {step.title} <span className="font-normal text-slate-400">{step.date}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-800">{step.description}</p>
                  <p className="mt-1 text-sm text-slate-400">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {order.whatsappStatus && order.whatsappStatus !== "failed" ? (
            <div className="flex w-full items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              <span>Order details sent to WhatsApp automatically.</span>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                WhatsApp confirmation is pending
                {order.whatsappError ? `: ${order.whatsappError}` : "."}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={retryingWhatsApp}
                onClick={() => void retryWhatsApp()}
              >
                {retryingWhatsApp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Resend WhatsApp confirmation"
                )}
              </Button>
            </div>
          )}

          <Link href={buildOrderTrackPath(order.orderNumber)}>
            <Button variant="outline">Track order</Button>
          </Link>
          <Link href="/my-orders">
            <Button>View my orders</Button>
          </Link>
          <Link href="/shop">
            <Button variant="outline">Continue shopping</Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
