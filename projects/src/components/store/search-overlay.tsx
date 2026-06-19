"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, X, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cleanProductTitle, formatCurrency } from "@/lib/utils";
import { normalizeProductImage } from "@/lib/product-images";
import type { Product } from "@/types/index";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((p) => results.length === 0 ? 0 : Math.min(p + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((p) => Math.max(p - 1, 0)); }
      if (e.key === "Enter" && results[selected]) {
        onClose();
        router.push(`/product/${results[selected].slug}`);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, onClose, router]);

  useEffect(() => {
    if (!query.trim() || !open) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&limit=8`);
        const data = await res.json();
        setResults(data.products ?? []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[300]" style={{ background: "rgba(0,0,0,.6)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }} onClick={onClose} />
      <div className="fixed left-1/2 top-[15vh] -translate-x-1/2 z-[301] w-full max-w-[560px] px-4 anim-fade-down" style={{ animation: "fade-down .3s ease-out" }}>
        <div className="glass-strong rounded-[var(--radius-lg)] overflow-hidden" style={{ boxShadow: "0 24px 80px rgba(0,0,0,.6)" }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-muted)" }} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
              placeholder="Search products..."
              className="flex-1 bg-transparent text-sm outline-none" style={{ color: "var(--text)" }}
              autoComplete="off"
            />
            <button type="button" onClick={onClose} className="header-icon">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--text-muted)" }} />
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="max-h-[360px] overflow-y-auto py-2">
              {results.map((product, i) => {
                const img = normalizeProductImage(product.images?.[0]);
                return (
                  <Link
                    key={product.id}
                    href={`/product/${product.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 px-5 py-2.5 transition-colors"
                    style={{ background: i === selected ? "var(--glass-hover)" : "transparent" }}
                  >
                    <div className="w-10 h-10 rounded-[var(--radius-sm)] overflow-hidden shrink-0" style={{ background: "var(--bg-card)" }}>
                      {img && <Image src={img} alt="" width={40} height={40} className="object-cover w-full h-full" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--text)" }}>{cleanProductTitle(product.title)}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{product.brand || product.category}</p>
                    </div>
                    <p className="text-sm font-medium shrink-0" style={{ color: "var(--text-secondary)" }}>{formatCurrency(product.price)}</p>
                  </Link>
                );
              })}
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No products found for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <div className="flex gap-3">
              <kbd className="mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>↑↓</kbd>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Navigate</span>
            </div>
            <div className="flex gap-3">
              <kbd className="mono px-1.5 py-0.5 rounded" style={{ background: "var(--bg-card)", color: "var(--text-muted)" }}>ESC</kbd>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>Close</span>
            </div>
            {query.trim() && (
              <Link href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={onClose} className="flex items-center gap-1 text-xs font-medium" style={{ color: "var(--accent)" }}>
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
