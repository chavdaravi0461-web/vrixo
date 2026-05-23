import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
loadEnv(path.join(root, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
}

const categories = [
  {
    category: "shoes",
    subcategory: "Sports Shoes",
    skuPrefix: "DC-SPT",
    brand: "StrideLab",
    baseTitle: "AeroRun Performance",
    shortDescription: "Comfortable sports shoe for running, walking, and daily training.",
    fullDescription:
      "Built for daily movement with breathable uppers, cushioned midsoles, and dependable grip for runs, workouts, commutes, and long walking days.",
    sizes: ["6", "7", "8", "9", "10"],
    colors: ["Black", "Navy", "White", "Grey"],
    imageKeywords: "running-shoes,sneakers,sports-shoes",
    specs: {
      Material: "Breathable mesh",
      Sole: "EVA cushioned sole",
      Closure: "Lace-up",
      Use: "Sports and daily training"
    }
  },
  {
    category: "shoes",
    subcategory: "Sneakers",
    skuPrefix: "DC-SNK",
    brand: "UrbanPace",
    baseTitle: "StreetCore Sneaker",
    shortDescription: "Everyday sneaker with clean styling and soft step comfort.",
    fullDescription:
      "Designed for casual outfits and city wear with a padded collar, flexible outsole, and versatile color finishes that pair easily with denim or athleisure.",
    sizes: ["6", "7", "8", "9", "10", "11"],
    colors: ["White", "Black", "Beige", "Blue"],
    imageKeywords: "sneakers,streetwear-shoes,casual-shoes",
    specs: {
      Material: "Synthetic leather and textile",
      Sole: "Rubber grip sole",
      Closure: "Lace-up",
      Style: "Casual streetwear"
    }
  },
  {
    category: "shoes",
    subcategory: "Formal Shoes",
    skuPrefix: "DC-FRM",
    brand: "Aureum",
    baseTitle: "RegalStep Formal",
    shortDescription: "Sharp formal shoe for office, events, and clean daily dressing.",
    fullDescription:
      "A polished formal pair with cushioned lining, structured upper, and refined finish for workwear, meetings, ceremonies, and evening occasions.",
    sizes: ["7", "8", "9", "10", "11"],
    colors: ["Black", "Tan", "Brown"],
    imageKeywords: "formal-shoes,leather-shoes,loafers",
    specs: {
      Material: "Premium synthetic leather",
      Sole: "TPR formal sole",
      Closure: "Lace-up / slip-on",
      Occasion: "Office and formal wear"
    }
  },
  {
    category: "watches",
    subcategory: "Smart Watch",
    skuPrefix: "DC-SMT",
    brand: "PulseX",
    baseTitle: "PulseFit Smart",
    shortDescription: "Smart watch for fitness tracking, calls, notifications, and daily use.",
    fullDescription:
      "A modern smart watch with health tracking, activity modes, Bluetooth calling support, bright display, and a comfortable strap for all-day use.",
    sizes: [],
    colors: ["Black", "Graphite", "Blue", "Rose Gold"],
    imageKeywords: "smart-watch,fitness-watch,digital-watch",
    specs: {
      Display: "HD touch display",
      Battery: "Up to 7 days",
      Connectivity: "Bluetooth calling",
      WaterResistance: "Splash resistant"
    }
  },
  {
    category: "watches",
    subcategory: "Dress Watch",
    skuPrefix: "DC-DRS",
    brand: "CrownVale",
    baseTitle: "ClassicDress Watch",
    shortDescription: "Elegant dress watch for office, gifting, and special occasions.",
    fullDescription:
      "A refined analog watch with a clean dial, premium case finish, and comfortable strap made for formal styling, daily office wear, and gifting.",
    sizes: [],
    colors: ["Silver", "Gold", "Black", "Brown"],
    imageKeywords: "classic-watch,analog-watch,dress-watch",
    specs: {
      Dial: "Analog minimal dial",
      Strap: "Steel or leather finish",
      Movement: "Quartz",
      CaseSize: "40 mm"
    }
  }
];

const imageSets = {
  "Sports Shoes": [
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80"
  ],
  Sneakers: [
    "https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1543508282-6319a3e2621f?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=900&q=80"
  ],
  "Formal Shoes": [
    "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1449505278894-297fdb3edbc1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=900&q=80"
  ],
  "Smart Watch": [
    "https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1510017803434-a899398421b3?auto=format&fit=crop&w=900&q=80"
  ],
  "Dress Watch": [
    "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=900&q=80",
    "https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=900&q=80"
  ]
};

const variants = [
  "Black",
  "Navy",
  "White",
  "Grey",
  "Tan",
  "Brown",
  "Blue",
  "Silver",
  "Gold",
  "Graphite",
  "Olive",
  "Red",
  "Beige",
  "Maroon",
  "Charcoal",
  "Rose",
  "Steel",
  "Ivory",
  "Midnight",
  "Classic"
];

const rows = categories.flatMap((entry) =>
  Array.from({ length: 20 }, (_, index) => buildProduct(entry, index + 1))
);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

const { error } = await supabase.from("products").upsert(rows, {
  onConflict: "slug",
  ignoreDuplicates: false
});

if (error) {
  throw new Error(error.message);
}

const { data, error: countError } = await supabase
  .from("products")
  .select("category, subcategory, status")
  .eq("status", "active")
  .in(
    "subcategory",
    categories.map((entry) => entry.subcategory)
  );

if (countError) {
  throw new Error(countError.message);
}

const counts = new Map();
for (const product of data ?? []) {
  const key = `${product.category} / ${product.subcategory}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

console.log(`Seeded ${rows.length} active products.`);
for (const entry of categories) {
  const key = `${entry.category} / ${entry.subcategory}`;
  console.log(`${key}: ${counts.get(key) ?? 0}`);
}

function buildProduct(entry, number) {
  const variant = variants[number - 1];
  const suffix = String(number).padStart(2, "0");
  const priceBase = entry.category === "shoes" ? 1299 : 1999;
  const price = priceBase + number * 120 + (entry.subcategory.length % 7) * 75;
  const originalPrice = price + 700 + (number % 5) * 140;
  const discountPercent = Math.round(((originalPrice - price) / originalPrice) * 100);
  const title = `${entry.baseTitle} ${variant}`;
  const slug = slugify(`${entry.subcategory}-${variant}-${suffix}`);
  const images = rotateImages(imageSets[entry.subcategory], number);

  return {
    slug,
    title,
    category: entry.category,
    subcategory: entry.subcategory,
    brand: entry.brand,
    short_description: entry.shortDescription,
    full_description: `${entry.fullDescription} This ${variant.toLowerCase()} variant is stocked by Vrixo with COD and secure online payment support.`,
    price,
    original_price: originalPrice,
    discount_percent: discountPercent,
    currency: "INR",
    stock: 12 + ((number * 3) % 24),
    sku: `${entry.skuPrefix}-${suffix}`,
    sizes: entry.sizes,
    colors: [variant, entry.colors[number % entry.colors.length]],
    images,
    featured: number <= 4,
    bestseller: number > 4 && number <= 8,
    new_arrival: number > 8 && number <= 14,
    rating: Number((4.1 + (number % 8) * 0.1).toFixed(1)),
    review_count: 18 + number * 7,
    status: "active",
    specifications: {
      ...entry.specs,
      Brand: entry.brand,
      Category: entry.subcategory,
      "COD Available": "Yes"
    },
    created_at: new Date(Date.UTC(2026, 4, 7, 8, number)).toISOString(),
    updated_at: new Date().toISOString()
  };
}

function rotateImages(images, number) {
  return images.map((_, index) => images[(index + number - 1) % images.length]);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] = process.env[key] ?? value;
  }
}
