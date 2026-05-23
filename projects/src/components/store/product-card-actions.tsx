"use client";

import { Heart, ShoppingBag, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";

export type ProductCardActionProduct = {
  id: string;
  slug: string;
  title: string;
  image: string;
  price: number;
  stock: number;
  selectedColor?: string;
  selectedSize?: string;
};

export function ProductCardMediaActions({ product }: { product: ProductCardActionProduct }) {
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const wished = useWishlistStore((state) => state.ids.includes(product.id));

  return (
    <button
      type="button"
      aria-label={wished ? "Remove from wishlist" : "Add to wishlist"}
      className="dc-focus-ring absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow-sm ring-1 ring-[#e3d7c7] transition hover:bg-[#181510] hover:text-white"
      onClick={() => {
        toggleWishlist(product.id);
        toast.success(wished ? "Removed from wishlist." : `${product.title} added to wishlist.`);
      }}
    >
      <Heart className={`h-5 w-5 ${wished ? "fill-red-500 text-red-500" : "text-slate-600"}`} />
    </button>
  );
}

export function ProductCardQuickAddButton({ product }: { product: ProductCardActionProduct }) {
  const addItem = useCartStore((state) => state.addItem);
  const inStock = product.stock > 0;

  return (
    <button
      type="button"
      className="dc-focus-ring grid h-10 flex-1 place-items-center rounded-full bg-[#181510] text-xs font-black uppercase tracking-[0.08em] text-white shadow-sm disabled:bg-[#9b9288]"
      disabled={!inStock}
      onClick={() => addToCart({ product, addItem })}
    >
      Quick add
    </button>
  );
}

export function ProductCardPurchaseButtons({ product }: { product: ProductCardActionProduct }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const inStock = product.stock > 0;

  return (
    <div className="mt-auto grid gap-2 pt-3 sm:grid-cols-2">
      <Button
        type="button"
        disabled={!inStock}
        size="sm"
        className="h-10 rounded-full bg-[#181510] px-2 text-[11px] font-black uppercase tracking-[0.08em] hover:bg-[#8a5a24] sm:text-xs"
        onClick={() => addToCart({ product, addItem })}
      >
        <ShoppingBag className="mr-1.5 h-4 w-4" />
        {inStock ? "Add" : "Sold"}
      </Button>
      <Button
        type="button"
        disabled={!inStock}
        size="sm"
        variant="outline"
        className="h-10 rounded-full border-[#d6c6b2] px-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#181510] hover:bg-[#f7f4ef] sm:text-xs"
        onClick={() => {
          if (addToCart({ product, addItem })) {
            router.push("/cart");
          }
        }}
      >
        <Zap className="mr-1.5 h-4 w-4" />
        Buy now
      </Button>
    </div>
  );
}

function addToCart({
  product,
  addItem
}: {
  product: ProductCardActionProduct;
  addItem: (item: {
    productId: string;
    slug: string;
    title: string;
    image: string;
    price: number;
    quantity: number;
    stock: number;
    selectedColor?: string;
    selectedSize?: string;
  }) => void;
}) {
  if (product.stock <= 0) {
    toast.error("This product is currently out of stock.");
    return false;
  }

  addItem({
    productId: product.id,
    slug: product.slug,
    title: product.title,
    image: product.image,
    price: product.price,
    quantity: 1,
    stock: product.stock,
    selectedColor: product.selectedColor,
    selectedSize: product.selectedSize
  });

  toast.success(`${product.title} added to cart.`);
  return true;
}
