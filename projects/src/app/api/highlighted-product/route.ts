import { NextResponse } from "next/server";
import { getHighlightedProduct } from "@/services/products";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const product = await getHighlightedProduct();
    if (!product) {
      return NextResponse.json({ product: null });
    }
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ product: null });
  }
}
