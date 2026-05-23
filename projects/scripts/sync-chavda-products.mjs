import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
const productPath = path.join(root, "src", "data", "product.ts");

loadEnv(envPath);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase admin env is missing. NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const products = loadFallbackProducts(productPath).filter((product) =>
  product.id.startsWith("chavda-")
);

const rows = products.map((product) => ({
  slug: product.slug,
  title: product.title,
  category: product.category,
  subcategory: product.subcategory,
  brand: product.brand,
  short_description: product.shortDescription,
  full_description: product.fullDescription,
  price: product.price,
  original_price: product.originalPrice,
  discount_percent: product.discountPercent,
  currency: product.currency,
  stock: product.stock,
  sku: product.sku,
  sizes: product.sizes,
  colors: product.colors,
  images: product.images,
  featured: product.featured,
  bestseller: product.bestseller,
  new_arrival: product.newArrival,
  rating: product.rating,
  review_count: product.reviewCount,
  status: "active",
  specifications: product.specifications,
  created_at: product.createdAt,
  updated_at: new Date().toISOString()
}));

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const before = await countChavdaProducts();
const { error } = await supabase.from("products").upsert(rows, {
  onConflict: "slug",
  ignoreDuplicates: false
});

if (error) {
  throw new Error(error.message);
}

const after = await countChavdaProducts();
console.log(`Chavda products in source: ${rows.length}`);
console.log(`Chavda products before sync: ${before}`);
console.log(`Chavda products after sync: ${after}`);

async function countChavdaProducts() {
  const { count, error: countError } = await supabase
    .from("products")
    .select("slug", { count: "exact", head: true })
    .like("sku", "CFH-%");

  if (countError) {
    throw new Error(countError.message);
  }

  return count ?? 0;
}

function loadFallbackProducts(filePath) {
  const source = fs
    .readFileSync(filePath, "utf8")
    .replace(/^import type .*;\s*/m, "")
    .replace("export const products: Product[] =", "const products =");
  const context = { products: [] };
  vm.createContext(context);
  vm.runInContext(`${source}\nproducts;`, context, {
    filename: filePath
  });
  return context.products;
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = process.env[key] ?? value;
  }
}
