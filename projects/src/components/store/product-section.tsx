import Link from "next/link";
import { ProductGrid } from "@/components/store/product-grid";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types/index";

export function ProductSection({
  eyebrow,
  title,
  description,
  products
}: {
  eyebrow: string;
  title: string;
  description: string;
  products: Product[];
}) {
  return (
    <section className="container mt-6 border border-[#e3d7c7] bg-white p-4 shadow-sm md:p-6">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#efe6da] pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a5a24]">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-black uppercase tracking-[0.04em] text-[#181510]">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm text-[#6b6256]">{description}</p>
        </div>
        <Link href="/shop">
          <Button className="rounded-none bg-[#181510] font-black uppercase tracking-[0.12em] hover:bg-[#8a5a24]">View all</Button>
        </Link>
      </div>
      <ProductGrid products={products} />
    </section>
  );
}
