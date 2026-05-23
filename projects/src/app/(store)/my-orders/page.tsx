import { AccountShell } from "@/components/store/account-shell";
import { LocalOrdersPageClient } from "@/components/store/local-orders-page-client";
import { OrderHistoryCards, type OrderHistoryItem, type OrderHistoryOrder } from "@/components/store/order-history-cards";
import { EmptyState } from "@/components/empty-state";
import { buildMetadata } from "@/lib/metadata";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";

export const metadata = {
  ...buildMetadata("My Orders"),
  robots: { index: false, follow: false }
};
export const dynamic = "force-dynamic";

export default async function MyOrdersPage() {
  if (!isSupabaseConfigured()) {
    return (
      <AccountShell current="/my-orders">
        <LocalOrdersPageClient />
      </AccountShell>
    );
  }

  const user = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <AccountShell current="/my-orders" showLogout>
      {data && data.length > 0 ? (
        <OrderHistoryCards orders={data.map(mapSupabaseOrder)} />
        ) : (
          <EmptyState
            title="No orders yet"
            description="Once you complete checkout, your orders will appear here."
            ctaLabel="Start shopping"
            ctaHref="/shop"
          />
        )}
    </AccountShell>
  );
}

type SupabaseOrderRow = {
  id: string;
  order_number: string | null;
  items: unknown;
  subtotal: number | null;
  discount: number | null;
  shipping_charge: number | null;
  total: number | null;
  payment_method: string | null;
  payment_status: string | null;
  order_status: string | null;
  shipping_address: unknown;
  coupon_code: string | null;
  created_at: string | null;
  razorpay_payment_id?: string | null;
  sms_status?: string | null;
};

function mapSupabaseOrder(order: SupabaseOrderRow): OrderHistoryOrder {
  return {
    id: String(order.id),
    orderNumber: String(order.order_number ?? order.id),
    items: normalizeItems(order.items),
    subtotal: Number(order.subtotal ?? 0),
    discount: Number(order.discount ?? 0),
    shippingCharge: Number(order.shipping_charge ?? 0),
    total: Number(order.total ?? 0),
    paymentMethod: String(order.payment_method ?? "cod"),
    paymentStatus: String(order.payment_status ?? "pending"),
    orderStatus: String(order.order_status ?? "pending"),
    shippingAddress: normalizeAddress(order.shipping_address),
    couponCode: order.coupon_code,
    createdAt: String(order.created_at ?? new Date().toISOString()),
    razorpayPaymentId: order.razorpay_payment_id,
    smsStatus: order.sms_status
  };
}

function normalizeItems(value: unknown): OrderHistoryItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    const title = String(record.title ?? "Vrixo product");

    return {
      productId: String(record.productId ?? record.product_id ?? `item-${index}`),
      slug: String(record.slug ?? ""),
      title,
      image: normalizeProductImage(record.image) ?? getFallbackProductImage(),
      price: Number(record.price ?? 0),
      quantity: Number(record.quantity ?? 1),
      stock: Number(record.stock ?? 0),
      selectedSize: record.selectedSize ? String(record.selectedSize) : undefined,
      selectedColor: record.selectedColor ? String(record.selectedColor) : undefined,
      sku: record.sku ? String(record.sku) : null
    };
  });
}

function normalizeAddress(value: unknown) {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
