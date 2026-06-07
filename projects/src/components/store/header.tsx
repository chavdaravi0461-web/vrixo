"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";

const menuItems = [
  {
    label: "Men's Footwear",
    href: "/shop?category=shoes",
    columns: [
      {
        title: "Style",
        links: [
          { label: "Sports Shoes", href: "/shop?category=shoes&subcategory=sports-shoes" },
          { label: "Casual Shoes", href: "/shop?category=shoes&subcategory=shoes" },
          { label: "Boots", href: "/shop?category=shoes&subcategory=boots" },
          { label: "Slides", href: "/shop?category=shoes&subcategory=slides" },
        ],
      },
      {
        title: "Top Picks",
        links: [
          { label: "Best Sellers", href: "/shop?sort=popularity" },
          { label: "New Arrivals", href: "/shop?sort=newest" },
          { label: "Trending Now", href: "/shop?sort=popular" },
        ],
      },
    ],
  },
  {
    label: "Women's Footwear",
    href: "/shop?category=shoes",
    columns: [
      {
        title: "Style",
        links: [
          { label: "Casual Shoes", href: "/shop?category=shoes&subcategory=shoes" },
          { label: "Sports Shoes", href: "/shop?category=shoes&subcategory=sports-shoes" },
          { label: "Slides", href: "/shop?category=shoes&subcategory=slides" },
        ],
      },
    ],
  },
  {
    label: "Watches",
    href: "/category/watches",
    columns: [
      {
        title: "Collections",
        links: [
          { label: "Men's Watches", href: "/shop?category=watches&subcategory=mens-watches" },
          { label: "Ladies Watches", href: "/shop?category=watches&subcategory=ladies-watches" },
          { label: "Digital Watches", href: "/shop?category=watches&subcategory=digital-watches" },
        ],
      },
    ],
  },
  { label: "Journal", href: "/about", columns: [] },
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSub, setMobileSub] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const items = useCartStore((s) => s.items);
  const hydrated = useCartStore((s) => s.hasHydrated);
  const wishlist = useWishlistStore((s) => s.ids);
  const count = useMemo(() => items.reduce((t, i) => t + i.quantity, 0), [items]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileSub(null);
  }, [pathname]);

  const handleSearch = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = new FormData(e.currentTarget).get("q")?.toString().trim();
    if (!q) return;
    const p = new URLSearchParams(params.toString());
    p.set("q", q);
    router.push(`/search?${p}`);
    setMenuOpen(false);
  }, [params, router]);

  return (
    <>
      <header className={`dc-header-luxe ${scrolled ? "scrolled" : ""}`}>
        <div className="dc-header-luxe-inner">
          <Link href="/home" className="dc-header-luxe-logo" aria-label="Vrixo">
            Vrixo
          </Link>

          <nav className="dc-header-luxe-nav max-[1024px]:hidden">
            <Link href="/home" className={cn(pathname === "/home" && "active")}>Home</Link>
            {menuItems.map((item) =>
              item.columns.length > 0 ? (
                <div key={item.label} className="nav-item-luxe relative">
                  <span className="nav-trigger">{item.label}</span>
                  <div className="dc-mega-luxe">
                    {item.columns.map((col) => (
                      <div key={col.title} className="dc-mega-luxe-col">
                        <h3>{col.title}</h3>
                        {col.links.map((link) => (
                          <Link key={link.label} href={link.href}>{link.label}</Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Link key={item.label} href={item.href}>{item.label}</Link>
              )
            )}
          </nav>

          <div className="dc-header-luxe-actions">
            <button
              type="button"
              aria-label="Search"
              className="dc-header-luxe-action max-[1024px]:hidden"
              onClick={() => {
                const input = document.querySelector<HTMLInputElement>(".dc-header-luxe-search-input");
                input?.focus();
              }}
            >
              <Search />
            </button>
            <Link href="/wishlist" className="dc-header-luxe-action" aria-label="Wishlist">
              <Heart />
              {hydrated && wishlist.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--dc-heading)] text-[7px] font-bold text-[var(--dc-bg)]">
                  {wishlist.length}
                </span>
              )}
            </Link>
            <Link href="/account" className="dc-header-luxe-action max-[640px]:hidden" aria-label="Account">
              <User />
            </Link>
            <Link href="/cart" className="dc-header-luxe-action" aria-label="Cart">
              <ShoppingBag />
              {hydrated && count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[var(--dc-heading)] text-[7px] font-bold text-[var(--dc-bg)]">
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </Link>
            <button
              type="button"
              aria-label="Menu"
              className="dc-header-luxe-action !hidden max-[1024px]:!flex"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>

      <div className="h-[68px]" />

      {menuOpen && (
        <div
          className="fixed inset-0 top-[68px] z-[99] bg-[var(--dc-bg)] overflow-y-auto anim-fade-in"
          style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}
        >
          <div className="px-6 pt-6 pb-4">
            <form onSubmit={handleSearch}>
              <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)] pb-3">
                <Search className="h-4 w-4 shrink-0 text-[var(--dc-muted-2)]" />
                <input
                  name="q"
                  placeholder="Search products..."
                  className="flex-1 bg-transparent text-sm text-[var(--dc-heading)] outline-none placeholder:text-[var(--dc-muted-2)]"
                  autoComplete="off"
                />
              </div>
            </form>
          </div>
          <nav className="px-6">
            <MobileMenuItem href="/home" label="Home" />
            {menuItems.map((item) => (
              <MobileMenuGroup
                key={item.label}
                item={item}
                open={mobileSub === item.label}
                onToggle={() => setMobileSub(mobileSub === item.label ? null : item.label)}
              />
            ))}
          </nav>
        </div>
      )}
    </>
  );
}

function MobileMenuItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={cn(
        "block py-3 text-sm font-medium transition-colors",
        pathname === href ? "text-[var(--dc-heading)]" : "text-[var(--dc-muted)] hover:text-[var(--dc-heading)]"
      )}
    >
      {label}
    </Link>
  );
}

function MobileMenuGroup({ item, open, onToggle }: { item: typeof menuItems[0]; open: boolean; onToggle: () => void }) {
  if (item.columns.length === 0) {
    return <MobileMenuItem href={item.href} label={item.label} />;
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-3 text-sm font-medium text-[var(--dc-muted)]"
      >
        {item.label}
        <svg
          className={`chevron transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ease-out ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="pb-3 pl-4">
          {item.columns.map((col) => (
            <div key={col.title} className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--dc-muted-2)]">
                {col.title}
              </p>
              {col.links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block py-1.5 text-sm text-[var(--dc-muted)] hover:text-[var(--dc-heading)] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AnnouncementBar() {
  return (
    <div className="hidden">
      <span>Easy Return</span>
      <span>Free Shipping All Over India</span>
      <span>Secure Payment</span>
    </div>
  );
}
