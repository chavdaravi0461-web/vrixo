"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useMemo, useState } from "react";
import { BRAND_LOGO_PATH } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";

const navLinks = [
  { href: "/home", label: "Home" },
  { href: "/category/shoes", label: "Men" },
  { href: "/category/shoes", label: "Women" },
  { href: "/category/shoes", label: "Shoes" },
  { href: "/category/watches", label: "Watches" },
  { href: "/shop?sort=newest", label: "New Arrivals" }
];

const megaLinks = [
  { href: "/shop?subcategory=Sneakers", label: "Sneakers", meta: "Daily polish" },
  { href: "/shop?subcategory=Formal%20Shoes", label: "Formal Shoes", meta: "Refined pairs" },
  { href: "/category/smart-watches", label: "Smart Watches", meta: "Modern utility" },
  { href: "/category/dress-watches", label: "Dress Watches", meta: "Timeless finish" }
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const items = useCartStore((state) => state.items);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const wishlistIds = useWishlistStore((state) => state.ids);
  const itemCount = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const search = String(formData.get("search") ?? "").trim();
    if (!search) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("q", search);
    router.push(`/search?${params.toString()}`);
    setMobileOpen(false);
  }

  return (
    <header className="dc-luxe-header">
      <div className="dc-luxe-shell">
        <Link href="/home" className="dc-luxe-brand dc-focus-ring" aria-label="Vrixo home">
          <span className="dc-luxe-mark" aria-hidden="true">
            <Image
              src={BRAND_LOGO_PATH}
              alt=""
              width={900}
              height={240}
              className="dc-brand-logo-image"
              priority
            />
          </span>
        </Link>

        <nav className="dc-luxe-nav" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <div key={`${link.href}-${link.label}`} className="dc-luxe-nav-item">
              <Link
                href={link.href}
                className={cn("dc-focus-ring", pathname === link.href && "dc-luxe-nav-active")}
              >
                {link.label}
              </Link>
              {["Men", "Women", "Shoes", "Watches"].includes(link.label) ? (
                <div className="dc-luxe-mega" role="menu">
                  <div>
                    <p className="dc-luxe-mega-eyebrow">Curated edit</p>
                    <h3>{link.label === "Watches" ? "Timeless wristwear" : "Premium footwear"}</h3>
                    <p>
                      Discover clean silhouettes, dependable everyday quality, and confident styling.
                    </p>
                  </div>
                  <div className="dc-luxe-mega-links">
                    {megaLinks.map((item) => (
                      <Link key={item.href} href={item.href}>
                        {item.label}
                        <span>{item.meta}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>

        <form className="dc-luxe-search" role="search" onSubmit={submitSearch}>
          <Search aria-hidden="true" />
          <input
            name="search"
            defaultValue={searchParams.get("q") ?? ""}
            placeholder="Search shoes, watches, brands..."
            aria-label="Search products"
          />
        </form>

        <div className="dc-luxe-actions">
          <Link href="/wishlist" className="dc-luxe-action dc-focus-ring" aria-label="Wishlist">
            <Heart aria-hidden="true" />
            <span>{wishlistIds.length > 0 ? wishlistIds.length : "Wish"}</span>
          </Link>
          <Link href="/account" className="dc-luxe-action dc-focus-ring" aria-label="Account">
            <User aria-hidden="true" />
            <span>Account</span>
          </Link>
          <Link href="/cart" className="dc-luxe-cart dc-focus-ring" aria-label="Cart">
            <ShoppingBag aria-hidden="true" />
            <span>Cart</span>
            {hasHydrated && itemCount > 0 ? <strong>{itemCount}</strong> : null}
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="dc-luxe-menu-btn dc-focus-ring"
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? <X className="mx-auto h-5 w-5" /> : <Menu className="mx-auto h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="dc-luxe-mobile">
          <form className="dc-luxe-mobile-search" role="search" onSubmit={submitSearch}>
            <input name="search" placeholder="Search Vrixo" aria-label="Search products" />
            <button type="submit">Search</button>
          </form>
          <nav className="dc-luxe-mobile-links" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <Link key={`${link.href}-${link.label}`} href={link.href} onClick={() => setMobileOpen(false)}>
                {link.label}
              </Link>
            ))}
            <Link href="/wishlist" onClick={() => setMobileOpen(false)}>Wishlist</Link>
            <Link href="/account" onClick={() => setMobileOpen(false)}>Account</Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
