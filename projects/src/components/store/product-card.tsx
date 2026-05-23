import Image from "next/image";
import Link from "next/link";
import { Eye, Star } from "lucide-react";
import {
  ProductCardMediaActions,
  ProductCardPurchaseButtons,
  ProductCardQuickAddButton,
  type ProductCardActionProduct
} from "@/components/store/product-card-actions";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";

export type ProductCardSummary = {
  id: string;
  slug: string;
  title: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  stock: number;
  selectedSize?: string;
  selectedColor?: string;
  image?: string;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  rating: number;
};

export function ProductCard({ product }: { product: ProductCardSummary }) {
  const productImage = normalizeProductImage(product.image) ?? getFallbackProductImage();
  const displayTitle = cleanProductTitle(product.title);
  const hasDiscount = product.discountPercent > 0 && product.originalPrice > product.price;
  const isNew = product.newArrival;
  const inStock = product.stock > 0;
  const actionProduct: ProductCardActionProduct = {
    id: product.id,
    slug: product.slug,
    title: displayTitle,
    image: productImage,
    price: product.price,
    stock: product.stock,
    selectedColor: product.selectedColor,
    selectedSize: product.selectedSize
  };

  return (
    <article className="dc-product-card group flex h-full flex-col">
      <div className="dc-product-image">
        <Link href={`/product/${product.slug}`} className="absolute inset-0" aria-label={displayTitle} prefetch={true}>
          <Image
            src={productImage}
            alt={displayTitle}
            fill
            sizes="(min-width: 1280px) 300px, (min-width: 1024px) 28vw, (min-width: 640px) 45vw, 92vw"
            quality={75}
            loading="lazy"
            className="object-contain p-4 sm:p-7"
          />
        </Link>
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.featured ? (
            <span className="rounded-full bg-[#181510] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#f3d7a0]">
              Featured
            </span>
          ) : null}
          {product.bestseller ? (
            <span className="rounded-full bg-[#8a5a24] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              Best seller
            </span>
          ) : null}
          {hasDiscount ? (
            <span className="rounded-full bg-[#b42318] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              {product.discountPercent}% off
            </span>
          ) : null}
          {isNew ? (
            <span className="rounded-full bg-[#181510] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">
              New
            </span>
          ) : null}
          {!inStock ? (
            <span className="rounded-full bg-[#e7dfd2] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#4a4036]">
              Sold out
            </span>
          ) : null}
        </div>
        <ProductCardMediaActions product={actionProduct} />
        <div className="absolute inset-x-3 bottom-3 hidden translate-y-3 gap-2 opacity-0 transition duration-300 group-hover:flex group-hover:translate-y-0 group-hover:opacity-100">
          <Link
            href={`/product/${product.slug}`}
            className="dc-focus-ring grid h-10 flex-1 place-items-center rounded-full bg-white/95 text-xs font-black uppercase tracking-[0.08em] text-[#181510] shadow-sm ring-1 ring-[#e3d7c7]"
          >
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              View
            </span>
          </Link>
          <ProductCardQuickAddButton product={actionProduct} />
        </div>
      </div>
      <div className="dc-product-info flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-[#8a5a24]">
            {product.brand || product.category}
          </p>
          {product.rating > 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1 bg-[#edf7ed] px-1.5 py-1 text-[11px] font-bold text-emerald-700">
              {product.rating.toFixed(product.rating % 1 === 0 ? 0 : 1)}
              <Star className="h-3 w-3 fill-emerald-600 text-emerald-600" />
            </span>
          ) : null}
        </div>
        <Link href={`/product/${product.slug}`} className="dc-product-title dc-line-clamp-2 mt-2 min-h-[2.65rem] hover:text-[#8a5a24]">
          {displayTitle}
        </Link>
        <p className="dc-product-meta truncate">{product.subcategory || product.category}</p>
        <div className="dc-product-price">
          <strong>{formatCurrency(product.price)}</strong>
          {hasDiscount ? (
            <del>
              {formatCurrency(product.originalPrice)}
            </del>
          ) : null}
          {hasDiscount ? (
            <span className="text-xs font-black text-[#b42318]">{product.discountPercent}% off</span>
          ) : null}
        </div>
        <p className={`mt-2 text-xs font-bold ${inStock ? "text-emerald-700" : "text-[#b42318]"}`}>
          {inStock ? `${product.stock} in stock` : "Currently unavailable"}
        </p>
        <ProductCardPurchaseButtons product={actionProduct} />
      </div>
    </article>
  );
}
