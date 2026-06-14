"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User, X, Sparkles } from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/store/cart-store";
import { useWishlistStore } from "@/lib/store/wishlist-store";
import dynamic from "next/dynamic";

const CartPanel = dynamic(() => import("./cart-panel").then((m) => ({ default: m.CartPanel })), { ssr: false });
const SearchOverlay = dynamic(() => import("./search-overlay").then((m) => ({ default: m.SearchOverlay })), { ssr: false });

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
  const [cartOpen, setCartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
    const handler = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setMobileSub(null);
    setSearchOpen(false);
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
      <header className={`header ${scrolled ? "scrolled" : ""}`}>
        <div className="header-inner">
          <Link href="/home" className="header-logo" aria-label="Vrixo">
            Vrixo
          </Link>

          <nav className="header-nav max-[1024px]:hidden">
            <Link href="/home" className={cn("header-nav-item", pathname === "/home" && "!text-[var(--text)]")}>Home</Link>
            {menuItems.map((item) =>
              item.columns.length > 0 ? (
                <div key={item.label} className="relative">
                  <span className="header-nav-item">{item.label}</span>
                  <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="glass-strong rounded-[var(--radius)] p-4 min-w-[200px]">
                      {item.columns.map((col) => (
                        <div key={col.title} className="mb-3 last:mb-0">
                          <p className="eyebrow mb-2 px-2">{col.title}</p>
                          {col.links.map((link) => (
                            <Link key={link.label} href={link.href} className="block px-2 py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors rounded-[4px] hover:bg-[var(--glass-hover)]">
                              {link.label}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <Link key={item.label} href={item.href} className="header-nav-item">{item.label}</Link>
              )
            )}
          </nav>

          <div className="header-actions">
            <button type="button" aria-label="Search" className="header-icon max-[1024px]:hidden" onClick={() => setSearchOpen(true)}>
              <Search className="h-[18px] w-[18px]" />
            </button>
            <Link href="/wishlist" className="header-icon" aria-label="Wishlist">
              <Heart className="h-[18px] w-[18px]" />
              {hydrated && wishlist.length > 0 && (
                <span className="header-badge">{wishlist.length}</span>
              )}
            </Link>
            <Link href="/account" className="header-icon max-[640px]:hidden" aria-label="Account">
              <User className="h-[18px] w-[18px]" />
            </Link>
            <button type="button" className="header-icon" aria-label="Cart" onClick={() => setCartOpen(true)}>
              <ShoppingBag className="h-[18px] w-[18px]" />
              {hydrated && count > 0 && (
                <span className="header-badge">{count > 9 ? "9+" : count}</span>
              )}
            </button>
            <button type="button" aria-label="AI" className="header-icon max-[1024px]:hidden">
              <Sparkles className="h-[18px] w-[18px]" />
            </button>
            <button type="button" aria-label="Menu" className="header-icon !hidden max-[1024px]:!flex" onClick={() => setMenuOpen((v) => !v)}>
              {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>
      </header>

      <div className="h-[64px]" />

      {menuOpen && (
        <div className="fixed inset-0 top-[64px] z-[99] bg-[var(--bg)] overflow-y-auto anim-fade-in" style={{ paddingBottom: "calc(80px + env(safe-area-inset-bottom))" }}>
          <div className="px-6 pt-6 pb-4">
            <form onSubmit={handleSearch}>
              <div className="flex items-center gap-3 border-b border-[var(--border)] pb-3">
                <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                <input name="q" placeholder="Search products..." className="search-input flex-1 bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]" autoComplete="off" />
              </div>
            </form>
          </div>
          <nav className="px-6">
            <MobileMenuItem href="/home" label="Home" />
            {menuItems.map((item) => (
              <MobileMenuGroup key={item.label} item={item} open={mobileSub === item.label} onToggle={() => setMobileSub(mobileSub === item.label ? null : item.label)} />
            ))}
          </nav>
        </div>
      )}

      <CartPanel open={cartOpen} onClose={() => setCartOpen(false)} />
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function MobileMenuItem({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return (
    <Link href={href} className={cn("block py-3 text-sm font-medium transition-colors", pathname === href ? "text-[var(--text)]" : "text-[var(--text-secondary)] hover:text-[var(--text)]")}>
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
      <button onClick={onToggle} className="flex w-full items-center justify-between py-3 text-sm font-medium text-[var(--text-secondary)]">
        {item.label}
        <svg className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className={`overflow-hidden transition-all duration-200 ease-out ${open ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="pb-3 pl-4">
          {item.columns.map((col) => (
            <div key={col.title} className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{col.title}</p>
              {col.links.map((link) => (
                <Link key={link.label} href={link.href} className="block py-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">{link.label}</Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
