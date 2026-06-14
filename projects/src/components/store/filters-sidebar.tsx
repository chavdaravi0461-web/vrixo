import Link from "next/link";
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

  return (
    <aside className={cn("glass-card", className)} style={{ padding: "20px", position: "sticky", top: "96px", alignSelf: "start" }}>
      <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        <h2 className="eyebrow" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Filters</h2>
        <p className="body-sm" style={{ marginTop: "4px" }}>Refine by style, price, and availability</p>
      </div>
      <div className="space-y-5" style={{ marginTop: "20px" }}>
        <FilterGroup title="Category" values={categories.map((value) => titleCase(value))} currentValue={current.category} keyName="category" current={current} valueFormatter={(value) => value.toLowerCase()} />
        {subcategories.length > 0 ? <FilterGroup title="Style" values={subcategories} currentValue={current.subcategory} keyName="subcategory" current={current} /> : null}
        <FilterGroup title="Audience" values={["Men", "Women", "Unisex"]} currentValue={current.audience} keyName="audience" current={current} valueFormatter={(value) => value.toLowerCase()} />
        <FilterGroup title="Brand" values={brands} currentValue={current.brand} keyName="brand" current={current} />
        {sizes.length > 0 ? <FilterGroup title="Size" values={sizes} currentValue={current.size} keyName="size" current={current} /> : null}

        <div>
          <h3 className="body-sm" style={{ fontWeight: 500, marginBottom: "8px", color: "var(--text)" }}>Price</h3>
          <div className="grid gap-2">
            {[
              { label: "Under Rs. 999", query: { priceMax: "999" } },
              { label: "Rs. 1,000 - Rs. 1,999", query: { priceMin: "1000", priceMax: "1999" } },
              { label: "Rs. 2,000+", query: { priceMin: "2000" } }
            ].map((entry) => (
              <Link key={entry.label} href={withQueryMany(current, entry.query, ["priceMin", "priceMax"])}
                className="rounded-full px-3 py-2 text-sm font-medium transition" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", textDecoration: "none" }}>
                {entry.label}
              </Link>
            ))}
          </div>
        </div>

        <FilterGroup title="Rating" values={["4", "4.5"]} currentValue={current.rating} keyName="rating" suffix="+" current={current} />

        <div>
          <h3 className="body-sm" style={{ fontWeight: 500, marginBottom: "8px", color: "var(--text)" }}>Availability</h3>
          <Link href={withQuery(current, "availability", "in-stock")}
            className="block rounded-full px-4 py-2.5 text-sm font-medium transition" style={{
              background: current.availability === "in-stock" ? "var(--accent)" : "var(--bg-elevated)",
              color: current.availability === "in-stock" ? "var(--bg)" : "var(--text-secondary)",
              textDecoration: "none"
            }}>
            In Stock Only
          </Link>
        </div>

        <Link href="/shop" className="block rounded-full px-4 py-2.5 text-center text-sm font-medium transition" style={{ border: "1px solid var(--border)", color: "var(--text-muted)", textDecoration: "none" }}>
          Clear all filters
        </Link>
      </div>
    </aside>
  );
}

function FilterGroup({ title, values, currentValue, keyName, suffix = "", current, valueFormatter = (value) => value }: {
  title: string; values: string[]; currentValue?: string; keyName: string; suffix?: string;
  current: Record<string, string | undefined>; valueFormatter?: (value: string) => string;
}) {
  if (values.length === 0) return null;
  return (
    <div>
      <h3 className="body-sm" style={{ fontWeight: 500, marginBottom: "8px", color: "var(--text)" }}>{title}</h3>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => {
          const queryValue = valueFormatter(value);
          const active = currentValue === queryValue || slugify(currentValue ?? "") === slugify(queryValue);
          return (
            <Link key={value} href={withQuery(current, keyName, queryValue)}
              className="rounded-full px-3 py-1.5 text-sm font-medium transition" style={{
                background: active ? "var(--accent)" : "var(--bg-elevated)",
                color: active ? "var(--bg)" : "var(--text-secondary)",
                textDecoration: "none"
              }}>
              {value}{suffix}
            </Link>
          );
        })}
      </div>
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
