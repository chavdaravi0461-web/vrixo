"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import type { Product } from "@/types/index";

type ProductFormState = {
  title: string;
  slug: string;
  category: "shoes" | "watches";
  subcategory: string;
  brand: string;
  short_description: string;
  full_description: string;
  price: string;
  original_price: string;
  discount_percent: string;
  currency: string;
  stock: string;
  sku: string;
  sizes: string;
  colors: string;
  images: string[];
  featured: boolean;
  bestseller: boolean;
  new_arrival: boolean;
  status: "active" | "draft" | "archived";
  specifications: string;
};

const productTypes = [
  { label: "Sports Shoes", category: "shoes", subcategory: "Sports Shoes" },
  { label: "Sneakers", category: "shoes", subcategory: "Sneakers" },
  { label: "Formal Shoes", category: "shoes", subcategory: "Formal Shoes" },
  { label: "Smart Watch", category: "watches", subcategory: "Smart Watch" },
  { label: "Dress Watch", category: "watches", subcategory: "Dress Watch" }
] as const;

export function ProductFormClient({ product }: { product?: Product }) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormState>(() => fromProduct(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const discount = useMemo(() => {
    const price = Number(form.price);
    const mrp = Number(form.original_price);
    if (!price || !mrp || mrp <= price) return "0";
    return String(Math.round(((mrp - price) / mrp) * 100));
  }, [form.original_price, form.price]);

  function setTitle(title: string) {
    setForm((current) => ({
      ...current,
      title,
      slug: current.slug && current.slug !== slugify(current.title) ? current.slug : slugify(title),
      sku: current.sku || buildSku(title)
    }));
  }

  function setProductType(value: string) {
    const productType = productTypes.find((entry) => entry.subcategory === value);
    if (!productType) return;
    setForm({
      ...form,
      category: productType.category,
      subcategory: productType.subcategory
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    const previews: string[] = [];

    try {
      for (const file of Array.from(files)) {
        const validationError = validateImageFile(file);
        if (validationError) {
          throw new Error(validationError);
        }

        if (file.size > 500 * 1024) {
          toast("Large image detected. For faster pages, use WebP under 200-300 KB.");
        }

        const uploadFile = await compressImageForUpload(file);
        previews.push(URL.createObjectURL(uploadFile));
        const body = new FormData();
        body.append("file", uploadFile);
        body.append("slug", form.slug || slugify(form.title) || "product");
        const response = await fetch("/api/admin/uploads/product-image", {
          method: "POST",
          body
        });
        const result = (await response.json()) as { url?: string; message?: string };
        if (!response.ok || !result.url) {
          throw new Error(result.message ?? "Image upload failed.");
        }
        uploaded.push(result.url);
      }
      setPreviewUrls((current) => [...current, ...previews]);
      setForm((current) => ({ ...current, images: [...current.images, ...uploaded] }));
      toast.success(`${uploaded.length} image${uploaded.length === 1 ? "" : "s"} uploaded.`);
    } catch (error) {
      previews.forEach((url) => URL.revokeObjectURL(url));
      toast.error(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        discount_percent: form.discount_percent || discount,
        price: Number(form.price),
        original_price: Number(form.original_price || form.price),
        stock: Number(form.stock),
        sizes: toList(form.sizes),
        colors: toList(form.colors),
        specifications: parseSpecs(form.specifications)
      };
      const response = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { message?: string; product?: { slug?: string } };

      if (!response.ok) {
        throw new Error(result.message ?? "Product could not be saved.");
      }

      toast.success(result.message ?? "Product saved.");
      router.push("/dashboard-admin-vrixo-ravi/products");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Product could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submitProduct} className="grid gap-6 xl:grid-cols-[1fr_360px]">
      <section className="space-y-5">
        <AdminCard title="Basic details">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Product name">
              <Input value={form.title} onChange={(event) => setTitle(event.target.value)} required />
            </Field>
            <Field label="Slug">
              <Input
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
                required
              />
            </Field>
            <Field label="SKU">
              <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} required />
            </Field>
            <Field label="Brand">
              <Input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            </Field>
            <Field label="Product category">
              <Select
                value={form.subcategory}
                onChange={(event) => setProductType(event.target.value)}
              >
                <option value="" disabled>
                  Select product category
                </option>
                {productTypes.map((productType) => (
                  <option key={productType.subcategory} value={productType.subcategory}>
                    {productType.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Main category">
              <Input value={form.category === "watches" ? "Watches" : "Shoes"} disabled />
            </Field>
          </div>
        </AdminCard>

        <AdminCard title="Description">
          <div className="grid gap-4">
            <Field label="Short description">
              <Textarea value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} />
            </Field>
            <Field label="Full description">
              <Textarea rows={6} value={form.full_description} onChange={(event) => setForm({ ...form, full_description: event.target.value })} />
            </Field>
          </div>
        </AdminCard>

        <AdminCard title="Images">
          <div className="grid gap-4">
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:bg-slate-100">
              <Upload className="h-6 w-6 text-slate-500" />
              <span className="mt-2 text-sm font-semibold text-slate-900">
                {uploading ? "Uploading..." : "Upload product images"}
              </span>
              <span className="mt-1 text-xs text-slate-500">JPG, PNG, or WebP up to 5 MB each</span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={uploading}
                onChange={(event) => uploadFiles(event.target.files)}
              />
            </label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[...form.images, ...previewUrls].slice(0, 8).map((image) => (
                <div key={image} className="relative aspect-square overflow-hidden rounded-md bg-slate-100">
                  <Image src={image} alt="Product preview" fill sizes="160px" className="object-cover" unoptimized={image.startsWith("blob:")} />
                  {form.images.includes(image) ? (
                    <button
                      type="button"
                      aria-label="Remove image"
                      title="Remove image"
                      className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white text-slate-700 shadow"
                      onClick={() => setForm((current) => ({ ...current, images: current.images.filter((url) => url !== image) }))}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </AdminCard>
      </section>

      <aside className="space-y-5">
        <AdminCard title="Publishing">
          <div className="grid gap-4">
            <Field label="Status">
              <Select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as ProductFormState["status"] })}
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
            </Field>
            <Toggle label="Featured" checked={form.featured} onChange={(featured) => setForm({ ...form, featured })} />
            <Toggle label="Bestseller" checked={form.bestseller} onChange={(bestseller) => setForm({ ...form, bestseller })} />
            <Toggle label="New arrival" checked={form.new_arrival} onChange={(new_arrival) => setForm({ ...form, new_arrival })} />
            <Button type="submit" disabled={saving || uploading}>
              {saving ? "Saving..." : product ? "Update product" : "Create product"}
            </Button>
          </div>
        </AdminCard>

        <AdminCard title="Pricing and stock">
          <div className="grid gap-4">
            <Field label="Selling price">
              <Input type="number" min="0" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
            </Field>
            <Field label="MRP / compare price">
              <Input type="number" min="0" value={form.original_price} onChange={(event) => setForm({ ...form, original_price: event.target.value })} />
            </Field>
            <Field label="Discount percent">
              <Input
                type="number"
                min="0"
                value={form.discount_percent || discount}
                onChange={(event) => setForm({ ...form, discount_percent: event.target.value })}
              />
              <p className="mt-2 text-xs text-slate-500">Auto-calculated from MRP and price when left empty.</p>
            </Field>
            <Field label="Stock quantity">
              <Input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
            </Field>
          </div>
        </AdminCard>

        <AdminCard title="Variants and specs">
          <div className="grid gap-4">
            <Field label="Sizes, comma separated">
              <Input value={form.sizes} onChange={(event) => setForm({ ...form, sizes: event.target.value })} />
            </Field>
            <Field label="Colors, comma separated">
              <Input value={form.colors} onChange={(event) => setForm({ ...form, colors: event.target.value })} />
            </Field>
            <Field label="Specifications JSON">
              <Textarea rows={6} value={form.specifications} onChange={(event) => setForm({ ...form, specifications: event.target.value })} />
            </Field>
          </div>
        </AdminCard>
      </aside>
    </form>
  );
}

function fromProduct(product?: Product): ProductFormState {
  return {
    title: product?.title ?? "",
    slug: product?.slug ?? "",
    category: product?.category ?? "shoes",
    subcategory: product?.subcategory ?? "",
    brand: product?.brand ?? "",
    short_description: product?.shortDescription ?? "",
    full_description: product?.fullDescription ?? "",
    price: product ? String(product.price) : "",
    original_price: product ? String(product.originalPrice) : "",
    discount_percent: product ? String(product.discountPercent) : "",
    currency: product?.currency ?? "INR",
    stock: product ? String(product.stock) : "0",
    sku: product?.sku ?? "",
    sizes: product?.sizes.join(", ") ?? "",
    colors: product?.colors.join(", ") ?? "",
    images: product?.images ?? [],
    featured: product?.featured ?? false,
    bestseller: product?.bestseller ?? false,
    new_arrival: product?.newArrival ?? false,
    status: product?.status ?? "active",
    specifications: JSON.stringify(product?.specifications ?? {}, null, 2)
  };
}

function buildSku(title: string) {
  const prefix = slugify(title).split("-").slice(0, 3).join("-").toUpperCase();
  return prefix ? `DC-${prefix}-${Date.now().toString().slice(-4)}` : "";
}

function validateImageFile(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

  if (!allowedTypes.has(file.type)) {
    return "Please upload JPG, PNG, or WebP image only.";
  }

  if (file.size > 5 * 1024 * 1024) {
    return "Image must be smaller than 5 MB.";
  }

  return null;
}

async function compressImageForUpload(file: File) {
  if (file.size <= 500 * 1024 || !file.type.startsWith("image/") || file.type === "image/webp") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1400;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", 0.78);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    return new File([blob], replaceImageExtension(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now()
    });
  } catch {
    return file;
  }
}

function replaceImageExtension(name: string, extension: string) {
  return name.replace(/\.[a-z0-9]+$/i, `.${extension}`);
}

function toList(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSpecs(value: string) {
  if (!value.trim()) return {};
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    throw new Error("Specifications must be valid JSON.");
  }
}

function AdminCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}
