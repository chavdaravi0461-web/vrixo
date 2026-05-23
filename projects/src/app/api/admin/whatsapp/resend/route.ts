import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueWhatsAppJob } from "@/services/notifications/whatsapp-queue";

export async function POST(request: Request) {
  const key = request.headers.get("x-admin-key") || request.headers.get("x-server-key");
  const secret = process.env.ADMIN_API_KEY || process.env.WHATSAPP_ADMIN_SECRET;

  if (!secret || key !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const orderId = String(body.orderId ?? "");

  if (!orderId) {
    return NextResponse.json({ message: "orderId required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, total, items, order_status, payment_method, payment_status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ message: "order not found" }, { status: 404 });

  // Enqueue WhatsApp job for resend
  const paymentMethod =
    String(order.payment_method ?? "").toLowerCase() === "cod" ? "cod" : "online";

  await enqueueWhatsAppJob(
    {
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerPhone: order.customer_phone,
      productNames: Array.isArray(order.items)
        ? order.items.map((item: { title?: string }) => item.title).filter(Boolean).join(", ") || ""
        : "",
      totalQty: Array.isArray(order.items)
        ? order.items.reduce((sum: number, item: { quantity?: number }) => sum + Number(item.quantity ?? 1), 0)
        : 1,
      totalAmount: Number(order.total ?? 0),
      orderStatus: String(order.order_status ?? "confirmed"),
      paymentMethod,
      paymentStatus: String(order.payment_status ?? (paymentMethod === "cod" ? "cod_pending" : "paid")),
      productImageUrl:
        Array.isArray(order.items) && order.items[0] ? String((order.items[0] as { image?: string }).image ?? "") : "",
      deliveryAddress: ""
    },
    { attempts: 3 }
  );

  return NextResponse.json({ ok: true, message: "whatsapp resend queued" });
}
