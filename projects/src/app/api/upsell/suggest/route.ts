import { NextResponse } from "next/server";
import { generateUpsellOffers } from "@/services/upsell/engine";

export async function POST(request: Request) {
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
