"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import { cleanProductTitle } from "@/lib/utils";
import { getFallbackProductImage, normalizeProductImage } from "@/lib/product-images";
import type { Product } from "@/types/index";

export function ProductActions({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const toggleWishlist = useWishlistStore((state) => state.toggle);
  const wished = useWishlistStore((state) => state.ids.includes(product.id));
  const [size, setSize] = useState((product.sizes ?? [])[0] ?? "");
  const [color, setColor] = useState((product.colors ?? [])[0] ?? "");
  const displayTitle = cleanProductTitle(product.title);
  const selectedColorIndex = product.colors.findIndex((entry) => entry === color);
  const selectedImage = selectedColorIndex >= 0 ? product.images[selectedColorIndex] : product.images[0];
  const productImage = normalizeProductImage(selectedImage ?? product.images[0]) ?? getFallbackProductImage();

  return (
    <div className="dc-product-actions mt-8 space-y-6">
      <div className="dc-product-option-grid grid gap-4 md:grid-cols-2">
        {(product.sizes ?? []).length > 0 ? (
          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--dc-text)]">Select size</label>
            <Select className="rounded-full" value={size} onChange={(event) => setSize(event.target.value)}>
              {product.sizes.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        {(product.colors ?? []).length > 0 ? (
          <div>
            <label className="mb-2 block text-sm font-bold text-[var(--dc-text)]">Select color</label>
            <Select className="rounded-full" value={color} onChange={(event) => setColor(event.target.value)}>
              {product.colors.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
      </div>
      <div className="dc-product-cta-grid grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          disabled={product.stock <= 0}
          className="h-12 rounded-full"
          onClick={() => {
            if (product.stock <= 0) {
              toast.error("This product is currently out of stock.");
              return;
            }

            addItem({
              productId: product.id,
              slug: product.slug,
              title: displayTitle,
              image: productImage,
              price: product.price,
              quantity: 1,
              stock: product.stock,
              selectedColor: color,
              selectedSize: size || undefined
            });
            toast.success(`${displayTitle} added to cart.`);
          }}
        >
          <ShoppingBag className="mr-2 h-4 w-4" />
          {product.stock > 0 ? "Add to cart" : "Sold Out"}
        </Button>
        <Button
          type="button"
          disabled={product.stock <= 0}
          className="h-12 rounded-full"
          onClick={() => {
            if (product.stock <= 0) {
              toast.error("This product is currently out of stock.");
              return;
            }

            addItem({
              productId: product.id,
              slug: product.slug,
              title: displayTitle,
              image: productImage,
              price: product.price,
              quantity: 1,
              stock: product.stock,
              selectedColor: color,
              selectedSize: size || undefined
            });
            router.push("/checkout");
          }}
        >
          Buy Now
        </Button>
      </div>
      <div className="dc-product-secondary-actions flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            toggleWishlist(product.id);
            toast.success(wished ? "Removed from wishlist." : "Added to wishlist.");
          }}
        >
          <Heart className={`mr-2 h-4 w-4 ${wished ? "fill-red-500 text-red-500" : ""}`} />
          Wishlist
        </Button>
      </div>
    </div>
  );
}

export function StickyMobileBar({ product }: { product: Product }) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const inStock = product.stock > 0;
  const [size, setSize] = useState((product.sizes ?? [])[0] ?? "");
  const [color, setColor] = useState((product.colors ?? [])[0] ?? "");

  if (inStock) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--bg-card)] p-3 shadow-lg md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold">{cleanProductTitle(product.title)}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{product.price} — {inStock ? "In stock" : "Sold out"}</p>
          </div>
          <button
            type="button"
            className="hero-btn hero-btn-primary"
            style={{ whiteSpace: "nowrap", fontSize: "13px", padding: "8px 20px" }}
            onClick={() => {
              addItem({
                productId: product.id,
                slug: product.slug,
                title: product.title,
                price: product.price,
                image: normalizeProductImage(product.images[0]) ?? getFallbackProductImage(),
                quantity: 1,
                stock: product.stock,
                selectedColor: color,
                selectedSize: size || undefined
              });
              toast.success("Added to cart");
            }}
          >
            <ShoppingBag className="mr-2 h-4 w-4" />
            Add to cart
          </button>
        </div>
      </div>
    );
  }
  return null;
}
