import { notFound } from "next/navigation";
import { ProductGrid } from "@/components/store/product-grid";
import { buildMetadata } from "@/lib/metadata";
import { getProducts } from "@/services/products";

const categories = {
  shoes: {
    title: "Shoes",
    description: "Explore premium sports shoes, casual shoes, sneakers, and formal pairs for every day."
  },
  "mens-shoes": {
    title: "Men's Shoes",
    description: "Shop men's shoes selected for daily style, comfort, and clean finishing.",
    category: "shoes",
    audience: "men"
  },
  "womens-shoes": {
    title: "Women's Shoes",
    description: "Shop women's shoes with elegant silhouettes, comfort, and polished finishing.",
    category: "shoes",
    audience: "women"
  },
  watches: {
    title: "Watches",
    description: "Discover chronographs, smart watches, dress watches, and modern wristwear essentials."
  },
  "mens-watches": {
    title: "Men's Watches",
    description: "Shop men's watches with bold daily, formal, and premium styles.",
    category: "watches",
    audience: "men"
  },
  "ladies-watches": {
    title: "Ladies Watches",
    description: "Shop women's watches with refined, elegant, and premium looks.",
    category: "watches",
    audience: "women"
  },
  "sports-shoes": {
    title: "Sports Shoes",
    description: "Shop Vrixo sports shoes built for everyday comfort and active style.",
    category: "shoes",
    subcategory: "Sports Shoes"
  },
  sportshoes: {
    title: "Sports Shoes",
    description: "Shop Vrixo sports shoes built for everyday comfort and active style.",
    category: "shoes",
    subcategory: "Sports Shoes"
  },
  sneakers: {
    title: "Sneakers",
    description: "Shop Vrixo sneakers for casual everyday styling.",
    category: "shoes",
    subcategory: "Sneakers"
  },
  "formal-shoes": {
    title: "Formal Shoes",
    description: "Shop polished formal shoes for office, events, and daily wear.",
    category: "shoes",
    subcategory: "Formal Shoes"
  },
  "smart-watch": {
    title: "Smart Watches",
    description: "Shop smart watches with modern features and daily utility.",
    category: "watches",
    subcategory: "Smart Watch"
  },
  "smart-watches": {
    title: "Smart Watches",
    description: "Shop smart watches with modern features and daily utility.",
    category: "watches",
    subcategory: "Smart Watch"
  },
  "dress-watch": {
    title: "Dress Watches",
    description: "Shop classic dress watches for refined everyday style.",
    category: "watches",
    subcategory: "Dress Watch"
  },
  "dress-watches": {
    title: "Dress Watches",
    description: "Shop classic dress watches for refined everyday style.",
    category: "watches",
    subcategory: "Dress Watch"
  }
} as const;

export async function generateMetadata({
  params
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const resolved = resolveCategory(category);
  if (!resolved) {
    return buildMetadata("Category");
  }
  return buildMetadata(resolved.title, resolved.description);
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const resolved = resolveCategory(category);
  if (!resolved) {
    notFound();
  }

  const products = await getProducts({
    category: resolved.category,
    subcategory: resolved.subcategory,
    audience: resolved.audience
  });

  return (
    <section className="pb-12 pt-6">
      <div className="dc-container">
      <div className="dc-page-hero p-5 md:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a5a24]">Category</p>
        <h1 className="mt-2 text-4xl font-black leading-tight text-[#181510] md:text-6xl">
          {resolved.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6b6256]">{resolved.description}</p>
        <p className="mt-4 inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700">
          {products.length} products available with COD and secure online checkout
        </p>
      </div>
      <div className="mt-5">
        <ProductGrid products={products} />
      </div>
      </div>
    </section>
  );
}

function resolveCategory(category: string) {
  const entry = categories[category as keyof typeof categories];
  if (!entry) return null;

  return {
    title: entry.title,
    description: entry.description,
    category: "category" in entry ? entry.category : category,
    subcategory: "subcategory" in entry ? entry.subcategory : undefined,
    audience: "audience" in entry ? entry.audience : undefined
  };
}
