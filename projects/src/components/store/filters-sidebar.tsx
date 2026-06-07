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
  const subcategories = Array.from(
    new Set(products.map((product) => product.subcategory).filter(Boolean))
  ).sort();

  return (
    <aside className={cn("dc-glass space-y-5 p-5 lg:sticky lg:top-32 lg:self-start", className)}>
      <div className="border-b border-[#efe6da] pb-3">
        <h2 className="text-lg font-black uppercase tracking-[0.08em] text-[#181510]">Filters</h2>
        <p className="mt-1 text-xs text-[#6b6256]">Refine by style, price, and availability</p>
      </div>
      <FilterGroup
        title="Category"
        values={categories.map((value) => titleCase(value))}
        currentValue={current.category}
        keyName="category"
        current={current}
        valueFormatter={(value) => value.toLowerCase()}
      />
      {subcategories.length > 0 ? (
        <FilterGroup
          title="Style"
          values={subcategories}
          currentValue={current.subcategory}
          keyName="subcategory"
          current={current}
        />
      ) : null}
      <FilterGroup
        title="Audience"
        values={["Men", "Women", "Unisex"]}
        currentValue={current.audience}
        keyName="audience"
        current={current}
        valueFormatter={(value) => value.toLowerCase()}
      />
      <FilterGroup
        title="Brand"
        values={brands}
        currentValue={current.brand}
        keyName="brand"
        current={current}
      />
      {sizes.length > 0 ? (
        <FilterGroup
          title="Size"
          values={sizes}
          currentValue={current.size}
          keyName="size"
          current={current}
        />
      ) : null}
      <div>
        <h3 className="text-sm font-bold text-slate-950">Price</h3>
        <div className="mt-3 grid gap-2">
          {[
            { label: "Under Rs. 999", query: { priceMax: "999" } },
            { label: "Rs. 1,000 - Rs. 1,999", query: { priceMin: "1000", priceMax: "1999" } },
            { label: "Rs. 2,000+", query: { priceMin: "2000" } }
          ].map((entry) => (
            <Link
              key={entry.label}
              href={withQueryMany(current, entry.query, ["priceMin", "priceMax"])}
            className="rounded-full bg-[#fbfaf8] px-3 py-2 text-sm font-semibold text-[#4a4036] transition hover:bg-[#181510] hover:text-white"
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </div>
      <FilterGroup
        title="Rating"
        values={["4", "4.5"]}
        currentValue={current.rating}
        keyName="rating"
        suffix="+"
        current={current}
      />
      <div>
        <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[#181510]">Availability</h3>
        <div className="mt-4">
          <Link
            href={withQuery(current, "availability", "in-stock")}
            className={`block rounded-full px-4 py-3 text-sm font-semibold ${
              current.availability === "in-stock"
                ? "bg-[#f7f4ef] text-[#8a5a24]"
                : "bg-[#fbfaf8] text-[#4a4036]"
            }`}
          >
            In Stock Only
          </Link>
        </div>
      </div>
      <Link href="/shop" className="block rounded-full border border-[#d6c6b2] px-4 py-3 text-center text-sm font-black uppercase tracking-[0.12em] text-[#4a4036] transition hover:border-[#181510] hover:text-[#181510]">
        Clear all filters
      </Link>
    </aside>
  );
}

function FilterGroup({
  title,
  values,
  currentValue,
  keyName,
  suffix = "",
  current,
  valueFormatter = (value) => value
}: {
  title: string;
  values: string[];
  currentValue?: string;
  keyName: string;
  suffix?: string;
  current: Record<string, string | undefined>;
  valueFormatter?: (value: string) => string;
}) {
  if (values.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.08em] text-[#181510]">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => {
          const queryValue = valueFormatter(value);
          const active = currentValue === queryValue || slugify(currentValue ?? "") === slugify(queryValue);
          return (
            <Link
              key={value}
              href={withQuery(current, keyName, queryValue)}
              className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                active ? "bg-[#181510] text-white" : "bg-[#f7f4ef] text-[#4a4036] hover:bg-[#e7dfd2]"
              }`}
            >
              {value}
              {suffix}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function withQuery(
  current: Record<string, string | undefined>,
  key: string,
  value: string
) {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([entryKey, entryValue]) => {
    if (entryValue && entryKey !== key) {
      params.set(entryKey, entryValue);
    }
  });
  params.set(key, value);
  return `/shop?${params.toString()}`;
}

function withQueryMany(
  current: Record<string, string | undefined>,
  next: Record<string, string | undefined>,
  replaceKeys: string[]
) {
  const params = new URLSearchParams();
  Object.entries(current).forEach(([entryKey, entryValue]) => {
    if (entryValue && !replaceKeys.includes(entryKey)) {
      params.set(entryKey, entryValue);
    }
  });
  Object.entries(next).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  return `/shop?${params.toString()}`;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
