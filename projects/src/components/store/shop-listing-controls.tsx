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
    if (trimmed) {
      params.set("search", trimmed);
    } else {
      params.delete("search");
    }
    router.push(`/shop?${params.toString()}`);
  }

  return (
    <>
      <div className="dc-soft-panel p-3 md:p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto] lg:items-center">
          <form onSubmit={submitSearch} className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search shoes, watches, brands..."
              className="dc-premium-input h-11 rounded-full border-[#d9cbb8] pl-10 shadow-none focus:border-[#8a5a24]"
            />
          </form>
          <ShopSort defaultValue={current.sort ?? ""} />
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full border-[#d9cbb8] lg:hidden"
            onClick={() => setFiltersOpen(true)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
          </Button>
          <div className="hidden text-right text-sm font-bold text-[#6b6256] lg:block">
            {productCount} of {totalCount} styles
          </div>
        </div>
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[86vh] overflow-y-auto rounded-t-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a5a24]">
                  Vrixo
                </p>
                <h2 className="text-xl font-black uppercase tracking-[0.04em] text-[#181510]">Filter products</h2>
              </div>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#f7f4ef]"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
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
