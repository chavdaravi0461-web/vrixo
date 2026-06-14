"use client";

import { useState } from "react";
import { SlidersHorizontal, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FiltersSidebar } from "@/components/store/filters-sidebar";
import { ShopSort } from "@/components/store/shop-sort";
import type { Product } from "@/types/index";

export function ShopListingControls({
  products,
  current,
  productCount,
  totalCount
}: {
  products: Product[];
  current: Record<string, string | undefined>;
  productCount: number;
  totalCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(current.search ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = search.trim();
    if (trimmed) params.set("search", trimmed);
    else params.delete("search");
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <>
      <div className="glass-card" style={{ padding: "12px 16px" }}>
        <div className="grid gap-3 lg:grid-cols-[1fr_200px_auto] lg:items-center">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shoes, watches, brands..."
              className="h-11"
              style={{ paddingLeft: "40px", background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)" }}
            />
          </form>
          <ShopSort defaultValue={current.sort ?? ""} />
          <Button
            type="button"
            variant="outline"
            className="h-11 lg:hidden"
            onClick={() => setFiltersOpen(true)}
            style={{ border: "1px solid var(--border)", color: "var(--text-secondary)", background: "transparent" }}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <div className="hidden text-right body-sm lg:block" style={{ color: "var(--text-muted)" }}>
            {productCount} of {totalCount} styles
          </div>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close filters" className="absolute inset-0" style={{ background: "rgba(0,0,0,.5)" }} onClick={() => setFiltersOpen(false)} />
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "86vh", overflowY: "auto",
            borderTopLeftRadius: "24px", borderTopRightRadius: "24px", background: "var(--bg-elevated)",
            padding: "16px", boxShadow: "var(--shadow-elevated)"
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: "12px" }}>
              <div>
                <p className="eyebrow">Vrixo</p>
                <h2 className="display-md" style={{ fontSize: "18px" }}>Filter products</h2>
              </div>
              <button type="button" className="header-icon" onClick={() => setFiltersOpen(false)} aria-label="Close filters">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FiltersSidebar products={products} current={current} className="border-0 p-0 shadow-none" />
          </div>
        </div>
      ) : null}
    </>
  );
}
