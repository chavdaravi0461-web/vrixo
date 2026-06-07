import { NextResponse } from "next/server";
import { getAppUrl } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueAbandonedJob } from "@/services/abandoned/abandoned-queue";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: Request) {
  const secret = request.headers.get("x-cron-key");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = getAppUrl();
  // find carts abandoned > 15 minutes and not yet recovered
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: carts } = await supabase.from("carts").select("id, user_id, session_id, items, total, updated_at").lt("updated_at", fifteenMinutesAgo).eq("abandoned", true).limit(100);

  if (!carts || carts.length === 0) return NextResponse.json({ processed: 0 });

  for (const cart of carts) {
    const items = Array.isArray(cart.items) ? cart.items : [];
    const checkoutLink = `${appUrl}/checkout?session=${encodeURIComponent(String(cart.session_id ?? ""))}`;
    await enqueueAbandonedJob({ orderNumber: cart.id, customerName: "", customerPhone: "", items, total: Number(cart.total ?? 0), checkoutLink, deliveryAddress: "" });
    // mark as recovered_scheduled to avoid duplicate scheduling
    await supabase.from("carts").update({ abandoned: true, recovered_scheduled: true }).eq("id", cart.id);
  }

  return NextResponse.json({ processed: carts.length });
});
