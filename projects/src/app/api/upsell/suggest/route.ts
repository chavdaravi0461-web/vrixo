import { NextResponse } from "next/server";
import { generateUpsellOffers } from "@/services/upsell/engine";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";

export async function POST(request: Request) {
  const limited = await checkServerRateLimit(request, { key: "upsell-suggest", limit: 30, windowMs: 60 * 1000 });
  if (!limited.allowed) {
    return NextResponse.json({ message: "Too many requests." }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ message: "Authentication required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items : [];

  if (items.length === 0) return NextResponse.json({ data: [] });

  try {
    const offers = await generateUpsellOffers(items);
    return NextResponse.json({ data: offers });
  } catch (err) {
    return NextResponse.json({ message: "failed", error: String(err) }, { status: 500 });
  }
}
