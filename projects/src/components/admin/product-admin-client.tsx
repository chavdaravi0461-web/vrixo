"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  BadgeIndianRupee,
  Boxes,
  Edit3,
  Eye,
  PackagePlus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Tag,
  Trash2,
  UploadCloud,
  X,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { slugify } from "@/lib/utils";
import type { Product } from "@/types/index";

export type AdminProductListItem = {
  id: string;
  title: string;
  slug: string;
  category: string;
  subcategory: string;
  brand: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  stock: number;
  sku: string;
  image: string;
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  highlighted: boolean;
  status: "active" | "draft" | "archived";
  createdAt: string;
};

type ProductAdminPagination = {
  page: number;
  limit: number;
  total: number;
};

type ProductAdminFilters = {
  search: string;
  status: string;
  category: string;
  sort: string;
};

type ProductAdminStats = {
  total: number;
  active: number;
  draft: number;
  lowStock: number;
};

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
  images: string;
  featured: boolean;
  bestseller: boolean;
  new_arrival: boolean;
  highlighted: boolean;
  status: "active" | "draft" | "archived";
  specifications: string;
};

const productTypes = [
  { label: "Men's Shoes", category: "shoes", subcategory: "Mens Shoes" },
  { label: "Women's Shoes", category: "shoes", subcategory: "Ladies Shoes" },
  { label: "Sports Shoes", category: "shoes", subcategory: "Sports Shoes" },
  { label: "Sneakers", category: "shoes", subcategory: "Sneakers" },
  { label: "Casual Shoes", category: "shoes", subcategory: "Casual Shoes" },
  { label: "Formal Shoes", category: "shoes", subcategory: "Formal Shoes" },
  { label: "Sandals", category: "shoes", subcategory: "Sandals" },
  { label: "Men's Watches", category: "watches", subcategory: "Mens Watches" },
  { label: "Ladies Watches", category: "watches", subcategory: "Ladies Watches" },
  { label: "Smart Watch", category: "watches", subcategory: "Smart Watch" },
  { label: "Dress Watch", category: "watches", subcategory: "Dress Watch" },
  { label: "Chronograph Watch", category: "watches", subcategory: "Chronograph Watch" },
  { label: "Luxury Watch", category: "watches", subcategory: "Luxury Watch" }
] as const;

const mainCategories = [
  {
    value: "shoes",
    label: "Shoes",
    description: "Sports, sneakers, casual, formal, and sandals"
  },
  {
    value: "watches",
    label: "Watches",
    description: "Smart, dress, chronograph, and luxury watches"
  }
] as const;

const maxProductImages = 8;

const emptyForm: ProductFormState = {
  title: "",
  slug: "",
  category: "shoes",
  subcategory: "Sports Shoes",
  brand: "",
  short_description: "",
  full_description: "",
  price: "",
  original_price: "",
  discount_percent: "",
  currency: "INR",
  stock: "0",
  sku: "",
  sizes: "",
  colors: "",
  images: "",
  featured: false,
  bestseller: false,
  new_arrival: true,
  highlighted: false,
  status: "active",
  specifications: "{}"
};

function fromProduct(product?: Product): ProductFormState {
  if (!product) return emptyForm;

  return {
    title: product.title,
    slug: product.slug,
    category: product.category,
    subcategory: product.subcategory,
    brand: product.brand,
    short_description: product.shortDescription,
    full_description: product.fullDescription,
    price: String(product.price),
    original_price: String(product.originalPrice),
    discount_percent: String(product.discountPercent),
    currency: product.currency,
    stock: String(product.stock),
    sku: product.sku,
    sizes: product.sizes.join(", "),
    colors: product.colors.join(", "),
    images: product.images.join("\n"),
    featured: product.featured,
    bestseller: product.bestseller,
    new_arrival: product.newArrival,
    highlighted: product.highlighted,
    status: product.status ?? "active",
    specifications: JSON.stringify(product.specifications ?? {}, null, 2)
  };
}

export function ProductAdminClient({
  products,
  pagination,
  filters,
  stats
}: {
  products: AdminProductListItem[];
  pagination: ProductAdminPagination;
  filters: ProductAdminFilters;
  stats: ProductAdminStats;
}) {
  const router = useRouter();
  const [productPatches, setProductPatches] = useState<Record<string, Partial<AdminProductListItem> | null>>({});
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([]);
  const [selectedImagePreviews, setSelectedImagePreviews] = useState<string[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [categoryFilter, setCategoryFilter] = useState(filters.category);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [sortFilter, setSortFilter] = useState(filters.sort);

  const currentImages = toImageList(form.images);
  const totalImageCount = currentImages.length + selectedImageFiles.length;
  const currentProducts = useMemo(
    () =>
      products
        .map((product) => {
          const patch = productPatches[product.id];
          return patch === null ? null : { ...product, ...patch };
        })
        .filter((product): product is AdminProductListItem => Boolean(product)),
    [productPatches, products]
  );
  const pageCount = Math.max(1, Math.ceil(pagination.total / pagination.limit));
  const currentPage = Math.min(pagination.page, pageCount);

  const discount = useMemo(() => {
    const price = Number(form.price);
    const mrp = Number(form.original_price);
    if (!price || !mrp || mrp <= price) return "0";
    return String(Math.round(((mrp - price) / mrp) * 100));
  }, [form.original_price, form.price]);

  const updateAdminProductsUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams();
    const next = {
      page: String(pagination.page),
      limit: String(pagination.limit),
      search: searchInput.trim(),
      status: statusFilter,
      category: categoryFilter,
      sort: sortFilter,
      ...updates
    };

    Object.entries(next).forEach(([key, value]) => {
      if (value && value !== "all" && !(key === "page" && value === "1") && !(key === "limit" && value === "20")) {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.replace(`/dashboard-admin-vrixo-ravi/products${queryString ? `?${queryString}` : ""}`, { scroll: false });
  }, [categoryFilter, pagination.limit, pagination.page, router, searchInput, sortFilter, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updateAdminProductsUrl({ search: searchInput.trim(), page: "1" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput, updateAdminProductsUrl]);

  function updateCategoryFilter(value: string) {
    setCategoryFilter(value);
    updateAdminProductsUrl({ category: value, page: "1" });
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    updateAdminProductsUrl({ status: value, page: "1" });
  }

  function updateSortFilter(value: string) {
    setSortFilter(value);
    updateAdminProductsUrl({ sort: value, page: "1" });
  }

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

    setForm((current) => ({
      ...current,
      category: productType.category,
      subcategory: productType.subcategory
    }));
  }

  function setMainCategory(category: ProductFormState["category"]) {
    const firstSubcategory = productTypes.find((entry) => entry.category === category)?.subcategory ?? "";

    setForm((current) => ({
      ...current,
      category,
      subcategory:
        productTypes.some((entry) => entry.category === category && entry.subcategory === current.subcategory)
          ? current.subcategory
          : firstSubcategory
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    clearSelectedImage();
  }

  async function loadProductForEdit(productId: string) {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/products/${productId}`);
      const payload = (await response.json().catch(() => null)) as { product?: Product; message?: string } | null;

      if (!response.ok || !payload?.product) {
        throw new Error(payload?.message ?? "Product details could not be loaded.");
      }

      setEditingId(productId);
      setForm(fromProduct(payload.product));
      clearSelectedImage();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Product details could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  function chooseImages(files: FileList | null) {
    setImageError(null);

    if (!files?.length) {
      setImageError("Please select product images.");
      return;
    }

    const incomingFiles = Array.from(files);
    const availableSlots = maxProductImages - totalImageCount;

    if (availableSlots <= 0) {
      const message = `Maximum ${maxProductImages} product images allowed.`;
      setImageError(message);
      toast.error(message);
      return;
    }

    const acceptedFiles: File[] = [];

    for (const file of incomingFiles.slice(0, availableSlots)) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setImageError(validationError);
        toast.error(validationError);
        return;
      }

      if (file.size > 500 * 1024) {
        toast("Large image detected. It will be compressed before upload when supported.");
      }

      acceptedFiles.push(file);
    }

    const previews = acceptedFiles.map((file) => URL.createObjectURL(file));
    setSelectedImageFiles((current) => [...current, ...acceptedFiles]);
    setSelectedImagePreviews((current) => [...current, ...previews]);

    if (incomingFiles.length > acceptedFiles.length) {
      toast.warning(`Only ${availableSlots} more image${availableSlots === 1 ? "" : "s"} can be added.`);
    }
  }

  function clearSelectedImage() {
    selectedImagePreviews.forEach((url) => URL.revokeObjectURL(url));

    setSelectedImageFiles([]);
    setSelectedImagePreviews([]);
    setImageError(null);
  }

  function removeSelectedImage(index: number) {
    setSelectedImagePreviews((current) => {
      const preview = current[index];
      if (preview) URL.revokeObjectURL(preview);
      return current.filter((_, previewIndex) => previewIndex !== index);
    });
    setSelectedImageFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  function removeSavedImage(imageUrl: string) {
    setForm((current) => ({
      ...current,
      images: toImageList(current.images).filter((url) => url !== imageUrl).join("\n")
    }));
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      let productImages = currentImages;

      if (selectedImageFiles.length > 0) {
        setUploading(true);
        const uploadedImages = await Promise.all(
          selectedImageFiles.map((file) => uploadProductImage(file, form.title || form.slug || "product"))
        );
        productImages = [...currentImages, ...uploadedImages].slice(0, maxProductImages);
      }

      if (productImages.length === 0) {
        throw new Error("Please select a product image before saving.");
      }

      const payload = {
        ...form,
        price: Number(form.price),
        original_price: Number(form.original_price || form.price),
        discount_percent:
          form.discount_percent !== "" ? Number(form.discount_percent) : Number(discount),
        stock: Number(form.stock),
        sizes: toList(form.sizes),
        colors: toList(form.colors),
        images: productImages,
        specifications: parseSpecifications(form.specifications)
      };

      const response = await fetch(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;

      if (!response.ok) {
        throw new Error(result?.message ?? "Product action failed.");
      }

      toast.success(result?.message ?? "Product saved.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Product action failed.");
    } finally {
      setUploading(false);
      setLoading(false);
    }
  }

  async function archiveProduct(product: AdminProductListItem) {
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      toast.error(payload?.message ?? "Product could not be archived.");
      return;
    }

    toast.success("Product archived.");
    setProductPatches((current) => ({ ...current, [product.id]: { status: "archived" } }));
  }

  async function updateProductVisibility(product: AdminProductListItem, status: "active" | "draft" | "archived") {
    const previousStatus = product.status ?? "active";
    setProductPatches((current) => ({ ...current, [product.id]: { status } }));

    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partial: true, status })
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setProductPatches((current) => ({ ...current, [product.id]: { status: previousStatus } }));
      toast.error(payload?.message ?? "Product visibility could not be updated.");
      return;
    }

    toast.success(status === "active" ? "Product is live on the website." : "Product hidden from website.");
  }

  async function permanentlyDeleteProduct(product: AdminProductListItem) {
    const confirmed = window.confirm(
      `Permanently delete "${product.title}"? This removes it from the database and website. Use Archive instead if this product has order history.`
    );

    if (!confirmed) return;

    const response = await fetch(`/api/admin/products/${product.id}?permanent=true`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      toast.error(payload?.message ?? "Product could not be permanently deleted.");
      return;
    }

    toast.success(payload?.message ?? "Product permanently deleted.");
    setProductPatches((current) => ({ ...current, [product.id]: null }));
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-6 border-b border-slate-200 bg-slate-950 p-6 text-white xl:grid-cols-[1fr_auto]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Catalog command center</p>
            <h1 className="mt-2 font-serif text-4xl font-semibold">Products</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Search, publish, update, and archive Vrixo products from one focused workspace.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[520px]">
            <Stat icon={Boxes} label="Total" value={stats.total} />
            <Stat icon={Eye} label="Active" value={stats.active} />
            <Stat icon={Archive} label="Draft" value={stats.draft} />
            <Stat icon={Tag} label="Low stock" value={stats.lowStock} tone={stats.lowStock ? "danger" : "normal"} />
          </div>
        </div>

        <div className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
              placeholder="Search by product name, SKU, brand, category"
              className="h-12 rounded-md border-slate-300 bg-slate-50 pl-10"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <FilterChip active={categoryFilter === "all"} onClick={() => updateCategoryFilter("all")}>All</FilterChip>
            <FilterChip active={categoryFilter === "shoes"} onClick={() => updateCategoryFilter("shoes")}>Shoes</FilterChip>
            <FilterChip active={categoryFilter === "watches"} onClick={() => updateCategoryFilter("watches")}>Watches</FilterChip>
            <FilterChip active={statusFilter === "active"} onClick={() => updateStatusFilter(statusFilter === "active" ? "all" : "active")}>
              Active
            </FilterChip>
            <FilterChip active={statusFilter === "draft"} onClick={() => updateStatusFilter(statusFilter === "draft" ? "all" : "draft")}>
              Draft
            </FilterChip>
            <Select className="h-10 max-w-[160px] rounded-md" value={sortFilter} onChange={(event) => updateSortFilter(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="price-asc">Price low</option>
              <option value="price-desc">Price high</option>
              <option value="stock-asc">Stock low</option>
              <option value="stock-desc">Stock high</option>
            </Select>
          </div>
        </div>
      </section>

      <div className="grid gap-6">
        <form className="order-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm" onSubmit={submitProduct}>
          <div className="border-b border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
                  {editingId ? "Editing" : "New product"}
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {editingId ? "Update product" : "Add product"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Add full product details: photos, name, about, price, MRP, discount, stock, variants, and highlights.
                </p>
              </div>
              {editingId ? (
                <Button type="button" variant="outline" className="rounded-md" onClick={resetForm}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  New
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 bg-slate-50 p-4 xl:grid-cols-2">
            <ProductFormSection index="1" title="Product photos" description="Upload clear front, side, and detail images from your computer.">
              <div className="rounded-md border border-dashed border-slate-300 bg-white p-4">
                <label className="flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-4 py-6 text-center transition hover:border-blue-400 hover:bg-blue-50">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-600 text-white">
                    <UploadCloud className="h-6 w-6" />
                  </span>
                  <span className="mt-3 text-sm font-black text-slate-950">
                    {totalImageCount ? `${totalImageCount}/${maxProductImages} photos selected` : "Choose product photos"}
                  </span>
                  <span className="mt-1 text-xs font-semibold text-slate-500">
                    Upload JPG, PNG, or WebP files directly. First image becomes the main product photo.
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    disabled={loading || uploading}
                    onChange={(event) => {
                      chooseImages(event.target.files);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                {imageError ? <p className="mt-3 text-sm font-semibold text-red-600">{imageError}</p> : null}
                {totalImageCount > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {currentImages.map((image) => (
                      <ImageThumb key={image} image={image} label="Saved" onRemove={() => removeSavedImage(image)} />
                    ))}
                    {selectedImagePreviews.map((image, index) => (
                      <ImageThumb
                        key={image}
                        image={image}
                        label={index === 0 && currentImages.length === 0 ? "Main" : "New"}
                        onRemove={() => removeSelectedImage(index)}
                        unoptimized
                      />
                    ))}
                  </div>
                ) : null}
                {selectedImageFiles.length > 0 ? (
                  <button
                    type="button"
                    className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    onClick={clearSelectedImage}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear selected photos
                  </button>
                ) : null}
              </div>
            </ProductFormSection>

            <ProductFormSection index="2" title="Basic product details" description="Name, brand, SKU, and listing URL for the product.">
              <div className="grid gap-3">
                <Field label="Product name">
                  <Input value={form.title} onChange={(event) => setTitle(event.target.value)} required />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Brand">
                    <Input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
                  </Field>
                  <Field label="SKU">
                    <Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value.toUpperCase() })} required />
                  </Field>
                </div>
                <Field label="Slug">
                  <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} required />
                </Field>
              </div>
            </ProductFormSection>

            <ProductFormSection index="3" title="Category mapping" description="Product wahi category page me dikhega jo yahan select karoge.">
              <div className="grid gap-3 sm:grid-cols-2">
                {mainCategories.map((category) => (
                  <CategoryBox
                    key={category.value}
                    active={form.category === category.value}
                    title={category.label}
                    description={category.description}
                    onClick={() => setMainCategory(category.value)}
                  />
                ))}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Main category">
                  <Select
                    value={form.category}
                    onChange={(event) => setMainCategory(event.target.value as ProductFormState["category"])}
                  >
                    <option value="shoes">Shoes</option>
                    <option value="watches">Watches</option>
                  </Select>
                </Field>
                <Field label="Product category">
                  <Select value={form.subcategory} onChange={(event) => setProductType(event.target.value)}>
                    {productTypes
                      .filter((productType) => productType.category === form.category)
                      .map((productType) => (
                        <option key={productType.subcategory} value={productType.subcategory}>
                          {productType.label}
                        </option>
                      ))}
                  </Select>
                </Field>
              </div>
            </ProductFormSection>

            <ProductFormSection index="4" title="Price, MRP, discount and stock" description="Set the exact customer price, compare price, discount percentage, and available quantity.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Price">
                  <Input type="number" min="1" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required />
                </Field>
                <Field label="MRP">
                  <Input type="number" min="0" value={form.original_price} onChange={(event) => setForm({ ...form, original_price: event.target.value })} />
                </Field>
                <Field label="Discount (%)">
                  <Input
                    type="number"
                    min="0"
                    value={form.discount_percent || discount}
                    onChange={(event) => setForm({ ...form, discount_percent: event.target.value })}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Auto-calculated from MRP and price when left empty. Current discount: {discount}% OFF.
                  </p>
                </Field>
                <Field label="Stock quantity">
                  <Input type="number" min="0" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} />
                </Field>
              </div>
            </ProductFormSection>

            <ProductFormSection index="5" title="About product and variants" description="Write customer-facing product details and add size/color options.">
              <div className="grid gap-3">
                <Field label="About product">
                  <Textarea rows={3} value={form.short_description} onChange={(event) => setForm({ ...form, short_description: event.target.value })} />
                </Field>
                <Field label="Full product details">
                  <Textarea rows={5} value={form.full_description} onChange={(event) => setForm({ ...form, full_description: event.target.value })} />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Sizes">
                    <Input placeholder="7, 8, 9" value={form.sizes} onChange={(event) => setForm({ ...form, sizes: event.target.value })} />
                  </Field>
                  <Field label="Colors">
                    <Input placeholder="Black, White" value={form.colors} onChange={(event) => setForm({ ...form, colors: event.target.value })} />
                  </Field>
                </div>
              </div>
            </ProductFormSection>

            <ProductFormSection index="6" title="Visibility and highlights" description="Control publish status and top placement badges.">
              <div className="grid gap-3">
                <Field label="Status">
                  <Select
                    value={form.status}
                    onChange={(event) => setForm({ ...form, status: event.target.value as ProductFormState["status"] })}
                  >
                    <option value="active">Active - show on website</option>
                    <option value="draft">Draft - hidden</option>
                    <option value="archived">Archived - hidden</option>
                  </Select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <HighlightBox
                    icon={Star}
                    title="Top Featured"
                    description="Website aur selected category ke top me premium priority."
                    checked={form.featured}
                    onChange={(featured) => setForm({ ...form, featured })}
                  />
                  <HighlightBox
                    icon={Sparkles}
                    title="Best Seller"
                    description="Popular product badge aur top placement ke liye."
                    checked={form.bestseller}
                    onChange={(bestseller) => setForm({ ...form, bestseller })}
                  />
                </div>
                <Toggle icon={PackagePlus} label="New arrival" checked={form.new_arrival} onChange={(new_arrival) => setForm({ ...form, new_arrival })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <HighlightBox
                    icon={Zap}
                    title="Highlight in Header"
                    description="Header me blink effect ke sath dikhega."
                    checked={form.highlighted}
                    onChange={(highlighted) => setForm({ ...form, highlighted })}
                  />
                  <div />
                </div>
              </div>
            </ProductFormSection>

            <details className="rounded-md border border-slate-200 bg-white p-4 xl:col-span-2">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">Advanced specifications JSON</summary>
              <div className="mt-4">
                <Field label="Specifications JSON">
                  <Textarea rows={5} value={form.specifications} onChange={(event) => setForm({ ...form, specifications: event.target.value })} />
                </Field>
              </div>
            </details>

            <div className="sticky bottom-0 -mx-4 -mb-4 border-t border-slate-200 bg-white/95 p-4 backdrop-blur xl:col-span-2">
              <Button type="submit" disabled={loading || uploading} className="h-12 w-full rounded-md bg-blue-600 hover:bg-blue-700">
                <Sparkles className="mr-2 h-4 w-4" />
                {uploading ? "Uploading photos..." : loading ? "Saving listing..." : editingId ? "Update product listing" : "Add product listing"}
              </Button>
            </div>
          </div>
        </form>

        <section className="order-2 rounded-md border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Inventory list</h2>
              <p className="mt-1 text-sm text-slate-500">{pagination.total} products found</p>
            </div>
            <Select className="max-w-[180px] rounded-md" value={statusFilter} onChange={(event) => updateStatusFilter(event.target.value)}>
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div className="overflow-hidden">
            {currentProducts.length ? (
              currentProducts.map((product) => (
                <article
                  key={product.id}
                  className="os-row grid gap-4 border-b border-[var(--os-border)] p-4 md:grid-cols-[88px_1fr_auto]"
                >
                  <div className="relative h-[88px] w-[88px] overflow-hidden rounded-md bg-slate-100">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.title}
                        fill
                        sizes="88px"
                        loading="lazy"
                        quality={60}
                        className="object-cover"
                      />
                    ) : (
                      <PackagePlus className="m-6 h-9 w-9 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start gap-2">
                      <h2 className="min-w-0 flex-1 truncate text-base font-bold text-slate-950">{product.title}</h2>
                      <Badge tone={product.status === "archived" ? "muted" : product.status === "draft" ? "warn" : "ok"}>
                        {(product.status ?? "active") === "active" ? "Live" : product.status}
                      </Badge>
                      {(product.status ?? "active") !== "active" ? <Badge tone="warn">Hidden on website</Badge> : null}
                      {product.stock <= 5 ? <Badge tone="danger">Low stock</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {product.sku || "No SKU"} / {product.brand || "No brand"} / {product.category} / {product.subcategory || "No subcategory"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {product.featured ? <Badge tone="premium">Top Featured</Badge> : null}
                      {product.bestseller ? <Badge tone="premium">Best Seller</Badge> : null}
                      {product.newArrival ? <Badge tone="muted">New Arrival</Badge> : null}
                      {product.highlighted ? <Badge tone="premium">Header Highlight</Badge> : null}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[150px_1fr] sm:items-center">
                      <div>
                        <p className="flex items-center gap-1 text-sm font-bold text-slate-950">
                          <BadgeIndianRupee className="h-4 w-4 text-emerald-700" />
                          {product.price}
                        </p>
                        {product.discountPercent > 0 ? (
                          <p className="mt-1 text-xs font-semibold text-emerald-700">
                            {product.discountPercent}% OFF
                            {product.originalPrice > product.price ? (
                              <span className="ml-2 text-slate-500 line-through">₹{product.originalPrice}</span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <StockBar stock={product.stock} />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:justify-end">
                    {(product.status ?? "active") !== "active" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-md"
                        onClick={() => updateProductVisibility(product, "active")}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Publish
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-md"
                        onClick={() => updateProductVisibility(product, "draft")}
                      >
                        Hide
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-md"
                      onClick={() => loadProductForEdit(product.id)}
                    >
                      <Edit3 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-md border-red-200 text-red-600"
                      onClick={() => archiveProduct(product)}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-md border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                      onClick={() => permanentlyDeleteProduct(product)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-10 text-center">
                <Search className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No products found</p>
              </div>
            )}
          </div>
          {pageCount > 1 ? (
            <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Showing {currentProducts.length} of {pagination.total} matching products.
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" className="rounded-md" disabled={currentPage <= 1} onClick={() => updateAdminProductsUrl({ page: String(currentPage - 1) })}>
                  Previous
                </Button>
                <span className="text-sm font-semibold text-slate-700">
                  Page {currentPage} of {pageCount}
                </span>
                <Button type="button" variant="outline" className="rounded-md" disabled={currentPage >= pageCount} onClick={() => updateAdminProductsUrl({ page: String(currentPage + 1) })}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>

      </div>
    </div>
  );
}

function ProductFormSection({
  index,
  title,
  description,
  children
}: {
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white shadow-sm">
      <div className="flex gap-3 border-b border-slate-100 p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">
          {index}
        </span>
        <div>
          <h3 className="text-sm font-black text-slate-950">{title}</h3>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone = "normal"
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "normal" | "danger";
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/10 px-4 py-3">
      <div className="flex items-center gap-2 text-slate-300">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-bold uppercase tracking-[0.14em]">{label}</p>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone === "danger" ? "text-red-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "danger" | "muted" | "premium" }) {
  const styles = {
    ok: "bg-green-50 text-green-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    muted: "bg-slate-100 text-slate-600",
    premium: "bg-[#181510] text-[#f3d7a0]"
  };

  return <span className={`rounded-md px-2 py-1 text-xs font-bold capitalize ${styles[tone]}`}>{children}</span>;
}

function FilterChip({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`h-10 rounded-md border px-4 text-sm font-bold transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function StockBar({ stock }: { stock: number }) {
  const value = Math.max(0, Math.min(100, (stock / 30) * 100));
  const tone = stock <= 5 ? "bg-red-500" : stock <= 15 ? "bg-amber-500" : "bg-emerald-600";

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>Stock</span>
        <span>{stock}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ImageThumb({
  image,
  label,
  onRemove,
  unoptimized = false
}: {
  image: string;
  label: string;
  onRemove: () => void;
  unoptimized?: boolean;
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-white">
      <Image
        src={image}
        alt={label}
        fill
        sizes="96px"
        className="object-cover"
        unoptimized={unoptimized || image.startsWith("blob:")}
      />
      <span className="absolute bottom-1 left-1 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
        {label}
      </span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        title={`Remove ${label}`}
        className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white text-slate-700 shadow transition hover:bg-red-50 hover:text-red-700"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CategoryBox({
  active,
  title,
  description,
  onClick
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`rounded-md border p-4 text-left transition ${
        active
          ? "border-[#181510] bg-[#181510] text-white shadow-md"
          : "border-slate-200 bg-white text-slate-800 hover:border-teal-300 hover:bg-teal-50/40"
      }`}
      onClick={onClick}
    >
      <span className={`text-xs font-black uppercase tracking-[0.16em] ${active ? "text-[#f3d7a0]" : "text-teal-700"}`}>
        Main category
      </span>
      <span className="mt-2 block text-lg font-black">{title}</span>
      <span className={`mt-1 block text-xs font-semibold leading-5 ${active ? "text-slate-200" : "text-slate-500"}`}>
        {description}
      </span>
    </button>
  );
}

function HighlightBox({
  icon: Icon,
  title,
  description,
  checked,
  onChange
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-md border p-4 transition ${
        checked
          ? "border-[#181510] bg-[#181510] text-white shadow-md"
          : "border-[#d8c9b5] bg-[#fffaf0] text-[#181510] hover:border-[#8a5a24]"
      }`}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="grid gap-2">
          <span className={`grid h-10 w-10 place-items-center rounded-full ${checked ? "bg-[#f3d7a0] text-[#181510]" : "bg-white text-[#8a5a24]"}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="text-sm font-black uppercase tracking-[0.12em]">{title}</span>
        </span>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-1 h-5 w-5 accent-[#8a5a24]"
        />
      </span>
      <span className={`mt-3 block text-xs font-semibold leading-5 ${checked ? "text-slate-200" : "text-[#6b6256]"}`}>
        {description}
      </span>
    </label>
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
  icon: Icon,
  label,
  checked,
  onChange
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
      <span className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-500" />
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function buildSku(title: string) {
  const prefix = slugify(title).split("-").slice(0, 3).join("-").toUpperCase();
  return prefix ? `DC-${prefix}-${Date.now().toString().slice(-4)}` : "";
}

async function uploadProductImage(file: File, productName: string) {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const uploadFile = await compressImageForUpload(file);
  const formData = new FormData();
  formData.set("file", uploadFile);
  formData.set("slug", slugify(productName) || "product");

  const response = await fetch("/api/admin/uploads/product-image", {
    method: "POST",
    body: formData
  });
  const result = (await response.json().catch(() => null)) as { message?: string; url?: string } | null;

  if (!response.ok || !result?.url) {
    throw new Error(result?.message ?? "Supabase image upload failed.");
  }

  return result.url;
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

function toImageList(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseSpecifications(value: string) {
  if (!value.trim()) return {};

  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    throw new Error("Specifications JSON sahi format me nahi hai.");
  }
}
