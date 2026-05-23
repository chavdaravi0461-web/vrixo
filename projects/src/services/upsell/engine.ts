import { createAdminClient } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/app-url";

export async function generateUpsellOffers(cartItems: Array<any>) {
  const supabase = createAdminClient();
  const appUrl = getAppUrl();
  // Strategy: find higher-priced items in same category or bundles
  const productIds = cartItems.map((i) => i.productId).filter(Boolean);
  const categoriesRes = await supabase.from("products").select("id, title, price, category_id, images").in("id", productIds).limit(50);
  const categories = categoriesRes.data ?? [];

  // fetch candidate upsell products: same category, price between 1.2x-3x
  const offers: any[] = [];
  for (const c of categories) {
    const candidates = await supabase
      .from("products")
      .select("id, title, price, images, slug")
      .eq("category_id", c.category_id)
      .gt("price", Math.ceil(Number(c.price) * 1.2))
      .lte("price", Math.ceil(Number(c.price) * 3))
      .limit(5);
    for (const p of candidates.data ?? []) {
      offers.push({ productId: p.id, title: p.title, price: p.price, image: p.images?.[0] ?? "", link: `${appUrl}/product/${p.slug}` });
    }
  }

  // dedupe and return top 5
  const uniq = new Map();
  for (const o of offers) {
    if (!uniq.has(o.productId)) uniq.set(o.productId, o);
  }

  return Array.from(uniq.values()).slice(0, 6);
}
