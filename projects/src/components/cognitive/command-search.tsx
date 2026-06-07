"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Command, X, TrendingUp, Package, ArrowRight } from "lucide-react";
import Link from "next/link";

const suggestions = [
  { label: "Premium Watches", href: "/shop?q=watches", icon: TrendingUp },
  { label: "Handcrafted Bags", href: "/shop?q=bags", icon: Package },
  { label: "Luxury Footwear", href: "/shop?q=shoes", icon: TrendingUp },
  { label: "New Arrivals", href: "/shop?sort=newest", icon: TrendingUp },
  { label: "Best Sellers", href: "/shop?sort=bestseller", icon: TrendingUp },
];

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.96, y: -12 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: -12,
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

export function CommandSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = query.trim()
    ? suggestions.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase()),
      )
    : suggestions;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filteredSuggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filteredSuggestions.length) % filteredSuggestions.length);
      } else if (e.key === "Enter" && filteredSuggestions[selectedIndex]) {
        window.location.href = filteredSuggestions[selectedIndex].href;
        setOpen(false);
      }
    },
    [filteredSuggestions, selectedIndex],
  );

  useEffect(() => {
    const handleGlobal = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="lp-btn lp-btn-secondary lp-btn-sm"
        aria-label="Search products"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="ml-2 hidden rounded border px-1.5 py-0.5 text-[10px] font-mono tracking-wider opacity-50 md:inline"
          style={{ borderColor: "var(--lp-border)" }}>
          <Command className="mr-0.5 inline h-2.5 w-2.5" />K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              variants={panelVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="relative w-full max-w-lg overflow-hidden rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.92)",
                backdropFilter: "blur(32px)",
                border: "1px solid rgba(255,255,255,0.4)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)",
              }}
            >
              <div className="flex items-center gap-3 border-b px-4 py-3"
                style={{ borderColor: "var(--lp-border)" }}>
                <Search className="h-4 w-4 shrink-0" style={{ color: "var(--lp-text-tertiary)" }} />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search products..."
                  className="flex-1 bg-transparent text-base outline-none"
                  style={{ color: "var(--lp-text)", fontFamily: "var(--lp-font)" }}
                />
                <button onClick={() => setOpen(false)} className="shrink-0 rounded-md p-1 transition-colors hover:bg-black/5">
                  <X className="h-4 w-4" style={{ color: "var(--lp-text-tertiary)" }} />
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto px-2 py-2">
                {filteredSuggestions.length === 0 ? (
                  <div className="px-3 py-8 text-center" style={{ color: "var(--lp-text-tertiary)" }}>
                    <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
                    <p className="mt-1 text-xs">Try a different search term</p>
                  </div>
                ) : (
                  filteredSuggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon;
                    return (
                      <Link
                        key={suggestion.label}
                        href={suggestion.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all"
                        style={{
                          background: index === selectedIndex
                            ? "var(--lp-glass)"
                            : "transparent",
                        }}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg"
                          style={{
                            background: index === selectedIndex
                              ? "var(--lp-accent-soft)"
                              : "var(--lp-bg-alt)",
                          }}>
                          <Icon className="h-4 w-4" style={{
                            color: index === selectedIndex ? "var(--lp-accent)" : "var(--lp-text-tertiary)",
                          }} />
                        </span>
                        <span className="flex-1 text-sm font-medium" style={{ color: "var(--lp-heading)" }}>
                          {suggestion.label}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--lp-text-tertiary)" }} />
                      </Link>
                    );
                  })
                )}
              </div>

              <div className="flex items-center gap-4 border-t px-4 py-2"
                style={{ borderColor: "var(--lp-border)", color: "var(--lp-text-tertiary)" }}>
                <span className="flex items-center gap-1 text-[11px]">
                  <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono"
                    style={{ borderColor: "var(--lp-border)" }}>↑</kbd>
                  <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono"
                    style={{ borderColor: "var(--lp-border)" }}>↓</kbd>
                  <span>navigate</span>
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono"
                    style={{ borderColor: "var(--lp-border)" }}>↵</kbd>
                  <span>open</span>
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  <kbd className="rounded border px-1.5 py-0.5 text-[10px] font-mono"
                    style={{ borderColor: "var(--lp-border)" }}>esc</kbd>
                  <span>close</span>
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
