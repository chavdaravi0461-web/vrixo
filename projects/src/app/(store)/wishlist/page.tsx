import { AccountShell } from "@/components/store/account-shell";
import { WishlistPageClient } from "@/components/store/wishlist-page-client";
import { buildMetadata } from "@/lib/metadata";
import { getProducts } from "@/services/products";

export const metadata = buildMetadata("Wishlist");

export default async function WishlistPage() {
  const products = await getProducts();

  return (
    <AccountShell current="/wishlist">
      <WishlistPageClient products={products} />
    </AccountShell>
  );
}
