"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";

export function ShopSort({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Select
      className="rounded-full"
      value={defaultValue}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        if (event.target.value) {
          params.set("sort", event.target.value);
        } else {
          params.delete("sort");
        }
        router.push(`/shop?${params.toString()}`);
      }}
    >
      <option value="">Newest</option>
      <option value="newest">Newest arrivals</option>
      <option value="price-asc">Price: Low to High</option>
      <option value="price-desc">Price: High to Low</option>
      <option value="name-asc">Name A-Z</option>
      <option value="popularity">Most reviewed</option>
    </Select>
  );
}
