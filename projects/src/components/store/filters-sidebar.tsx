"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Product } from "@/types/index";
import { cn, slugify } from "@/lib/utils";

export function FiltersSidebar({
  products,
  current,
  className
}: {
  products: Product[];
  current: Record<string, string | undefined>;
  className?: string;
}) {
  const brands = Array.from(new Set(products.map((product) => product.brand))).sort();
  const sizes = Array.from(new Set(products.flatMap((product) => product.sizes))).sort();
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  const subcategories = Array.from(new Set(products.map((product) => product.subcategory).filter(Boolean))).sort();

  const activeCount = Object.values(current).filter(Boolean).length;

  return (
    <aside className={cn("glass-card", className)} style={{ padding: "20px", position: "sticky", top: "96px", alignSelf: "start" }}>
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 className="eyebrow" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Filters</h2>
          <p className="body-sm" style={{ marginTop: "4px" }}>Refine your search</p>
        </div>
        {activeCount > 0 && (
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--bg)", background: "var(--accent)", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {activeCount}
          </span>
        )}
      </div>
      <div className="space-y-1" style={{ marginTop: "16px" }}>
        <CollapsibleFilter title="Category" count={categories.length} defaultOpen>
          <FilterChips values={categories.map((v) => titleCase(v))} currentValue={current.category} keyName="category" current={current} valueFormatter={(v) => v.toLowerCase()} />
        </CollapsibleFilter>

        {subcategories.length > 0 && (
          <CollapsibleFilter title="Style" count={subcategories.length}>
            <FilterChips values={subcategories} currentValue={current.subcategory} keyName="subcategory" current={current} />
          </CollapsibleFilter>
        )}

        <CollapsibleFilter title="Audience" count={3}>
          <FilterChips values={["Men", "Women", "Unisex"]} currentValue={current.audience} keyName="audience" current={current} valueFormatter={(v) => v.toLowerCase()} />
        </CollapsibleFilter>

        <CollapsibleFilter title="Brand" count={brands.length}>
          <FilterChips values={brands} currentValue={current.brand} keyName="brand" current={current} />
        </CollapsibleFilter>

        {sizes.length > 0 && (
          <CollapsibleFilter title="Size" count={sizes.length}>
            <FilterChips values={sizes} currentValue={current.size} keyName="size" current={current} />
          </CollapsibleFilter>
        )}

        <CollapsibleFilter title="Price" count={3}>
          <div className="space-y-2">
            {[
              { label: "Under Rs. 999", query: { priceMax: "999" } },
              { label: "Rs. 1,000 - Rs. 1,999", query: { priceMin: "1000", priceMax: "1999" } },
              { label: "Rs. 2,000+", query: { priceMin: "2000" } }
            ].map((entry) => {
              const active = (entry.query.priceMax && current.priceMax === entry.query.priceMax && !current.priceMin) ||
                (entry.query.priceMin && current.priceMin === entry.query.priceMin && !entry.query.priceMax && !current.priceMax) ||
                (entry.query.priceMin && entry.query.priceMax && current.priceMin === entry.query.priceMin && current.priceMax === entry.query.priceMax);
              return (
                <Link key={entry.label} href={withQueryMany(current, entry.query, ["priceMin", "priceMax"])}
                  className={`filter-chip ${active ? "active" : ""}`}>
                  {entry.label}
                </Link>
              );
            })}
          </div>
        </CollapsibleFilter>

        <CollapsibleFilter title="Rating" count={2}>
          <FilterChips values={["4", "4.5"]} currentValue={current.rating} keyName="rating" suffix="+" current={current} />
        </CollapsibleFilter>

        <CollapsibleFilter title="Availability" count={1}>
          <Link href={withQuery(current, "availability", "in-stock")}
            className={`filter-chip ${current.availability === "in-stock" ? "active" : ""}`}>
            In Stock Only
          </Link>
        </CollapsibleFilter>

        {activeCount > 0 && (
          <Link href="/shop" className="block mt-4 text-center text-xs font-medium py-2.5 rounded-full transition-all" style={{ border: "1px solid var(--border)", color: "var(--accent)" }}>
            Clear all ({activeCount})
          </Link>
        )}
      </div>
    </aside>
  );
}

function CollapsibleFilter({ title, count, defaultOpen = false, children }: {
  title: string; count: number; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sectionId = `filter-section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <h3>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={sectionId}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", background: "none", border: "none", cursor: "pointer", color: "var(--text)" }}
        >
          <span style={{ fontSize: "13px", fontWeight: 500 }}>{title}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{count}</span>
            <ChevronDown size={14} style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform .3s ease" }} aria-hidden="true" />
          </div>
        </button>
      </h3>
      <div id={sectionId} role="region" aria-labelledby={`filter-${title.toLowerCase().replace(/\s+/g, "-")}`} style={{ maxHeight: open ? "400px" : "0", overflow: "hidden", transition: "max-height .3s cubic-bezier(.33,1,.68,1)" }}>
        <div style={{ paddingBottom: "12px" }}>{children}</div>
      </div>
    </div>
  );
}

function FilterChips({ values, currentValue, keyName, suffix = "", current, valueFormatter = (v) => v }: {
  values: string[]; currentValue?: string; keyName: string; suffix?: string;
  current: Record<string, string | undefined>; valueFormatter?: (v: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => {
        const queryValue = valueFormatter(value);
        const active = currentValue === queryValue || slugify(currentValue ?? "") === slugify(queryValue);
        return (
          <Link key={value} href={withQuery(current, keyName, queryValue)}
            className={`filter-chip ${active ? "active" : ""}`}>
            {value}{suffix}
          </Link>
        );
      })}
    </div>
  );
}

function withQuery(current: Record<string, string | undefined>, key: string, value: string) {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([entryKey, entryValue]) => { if (entryValue && entryKey !== key) params.set(entryKey, entryValue); });
  params.set(key, value);
  return `/shop?${params.toString()}`;
}

function withQueryMany(current: Record<string, string | undefined>, next: Record<string, string | undefined>, replaceKeys: string[]) {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([entryKey, entryValue]) => { if (entryValue && !replaceKeys.includes(entryKey)) params.set(entryKey, entryValue); });
  Object.entries(next).forEach(([key, value]) => { if (value) params.set(key, value); });
  return `/shop?${params.toString()}`;
}

function titleCase(value: string) { return value.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
