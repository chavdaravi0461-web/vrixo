import { buildMetadata } from "@/lib/metadata";
import {
  getBestSellerProducts,
  getFeaturedProducts,
  getNewArrivalProducts,
  getProducts
} from "@/services/products";
import { HomeContent } from "@/components/store/home-content";

export const metadata = buildMetadata(
  "Premium Shoes & Watches",
  "Shop Vrixo premium shoes and timeless watches with COD, secure online payment, easy returns, and genuine products."
);

export const revalidate = 300;

export default async function HomePage() {
  const [allProducts, featured, bestSellers, newArrivals] = await Promise.all([
    getProducts(),
    getFeaturedProducts(),
    getBestSellerProducts(),
    getNewArrivalProducts()
  ]);

  return (
    <HomeContent
      allProducts={allProducts}
      featured={featured}
      bestSellers={bestSellers}
      newArrivals={newArrivals}
    />
  );
}
