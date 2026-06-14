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
  Zap,
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

type ProductAdminPagination = { page: number; limit: number; total: number };
type ProductAdminFilters = { search: string; status: string; category: string; sort: string };
type ProductAdminStats = { total: number; active: number; draft: number; lowStock: number };

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
  highlightedImageIndex: number;
  audience: "men" | "women" | "unisex" | "";
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
  { label: "Luxury Watch", category: "watches", subcategory: "Luxury Watch" },
] as const;

const mainCategories = [
  { value: "shoes", label: "Shoes", description: "Sports, sneakers, casual, formal, and sandals" },
  { value: "watches", label: "Watches", description: "Smart, dress, chronograph, and luxury watches" },
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
  highlightedImageIndex: 0,
  audience: "",
  status: "active",
  specifications: "{}",
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
    highlightedImageIndex: Number(product.specifications?.heroImageIndex ?? 0),
    audience: (product.specifications?.audience as "men" | "women" | "unisex" | "") ?? "",
    status: product.status ?? "active",
    specifications: JSON.stringify(product.specifications ?? {}, null, 2),
  };
}

export function ProductAdminClient({
  products,
  pagination,
  filters,
  stats,
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

  const updateAdminProductsUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      const next = {
        page: String(pagination.page),
        limit: String(pagination.limit),
        search: searchInput.trim(),
        status: statusFilter,
        category: categoryFilter,
        sort: sortFilter,
        ...updates,
      };
      Object.entries(next).forEach(([key, value]) => {
        if (value && value !== "all" && !(key === "page" && value === "1") && !(key === "limit" && value === "20")) {
          params.set(key, value);
        }
      });
      const queryString = params.toString();
      router.replace(`/dashboard-admin-vrixo-ravi/products${queryString ? `?${queryString}` : ""}`, { scroll: false });
    },
    [categoryFilter, pagination.limit, pagination.page, router, searchInput, sortFilter, statusFilter]
  );

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
      sku: current.sku || buildSku(title),
    }));
  }

  function setProductType(value: string) {
    const productType = productTypes.find((entry) => entry.subcategory === value);
    if (!productType) return;
    setForm((current) => ({ ...current, category: productType.category, subcategory: productType.subcategory }));
  }

  function setMainCategory(category: ProductFormState["category"]) {
    const firstSubcategory = productTypes.find((entry) => entry.category === category)?.subcategory ?? "";
    setForm((current) => ({
      ...current,
      category,
      subcategory: productTypes.some((entry) => entry.category === category && entry.subcategory === current.subcategory)
        ? current.subcategory
        : firstSubcategory,
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
      if (!response.ok || !payload?.product) throw new Error(payload?.message ?? "Product details could not be loaded.");
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
    if (!files?.length) { setImageError("Please select product images."); return; }
    const incomingFiles = Array.from(files);
    const availableSlots = maxProductImages - totalImageCount;
    if (availableSlots <= 0) {
      const message = `Maximum ${maxProductImages} product images allowed.`;
      setImageError(message); toast.error(message); return;
    }
    const acceptedFiles: File[] = [];
    for (const file of incomingFiles.slice(0, availableSlots)) {
      const validationError = validateImageFile(file);
      if (validationError) { setImageError(validationError); toast.error(validationError); return; }
      if (file.size > 500 * 1024) toast("Large image detected. It will be compressed before upload when supported.");
      acceptedFiles.push(file);
    }
    const previews = acceptedFiles.map((file) => URL.createObjectURL(file));
    setSelectedImageFiles((current) => [...current, ...acceptedFiles]);
    setSelectedImagePreviews((current) => [...current, ...previews]);
    if (incomingFiles.length > acceptedFiles.length) toast.warning(`Only ${availableSlots} more image${availableSlots === 1 ? "" : "s"} can be added.`);
  }

  function clearSelectedImage() {
    selectedImagePreviews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedImageFiles([]);
    setSelectedImagePreviews([]);
    setImageError(null);
  }

  function removeSelectedImage(index: number) {
    setSelectedImagePreviews((current) => { const preview = current[index]; if (preview) URL.revokeObjectURL(preview); return current.filter((_, i) => i !== index); });
    setSelectedImageFiles((current) => current.filter((_, i) => i !== index));
  }

  function removeSavedImage(imageUrl: string) {
    setForm((current) => ({ ...current, images: toImageList(current.images).filter((url) => url !== imageUrl).join("\n") }));
  }

  async function submitProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      let productImages = currentImages;
      if (selectedImageFiles.length > 0) {
        setUploading(true);
        const uploadedImages = await Promise.all(selectedImageFiles.map((file) => uploadProductImage(file, form.title || form.slug || "product")));
        productImages = [...currentImages, ...uploadedImages].slice(0, maxProductImages);
      }
      if (productImages.length === 0) throw new Error("Please select a product image before saving.");
      const payload = {
        ...form,
        price: Number(form.price),
        original_price: Number(form.original_price || form.price),
        discount_percent: form.discount_percent !== "" ? Number(form.discount_percent) : Number(discount),
        stock: Number(form.stock),
        sizes: toList(form.sizes),
        colors: toList(form.colors),
        images: productImages,
        specifications: { ...parseSpecifications(form.specifications), heroImageIndex: String(form.highlightedImageIndex), ...(form.audience ? { audience: form.audience } : {}) },
      };
      const response = await fetch(editingId ? `/api/admin/products/${editingId}` : "/api/admin/products", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "Product action failed.");
      toast.success(result?.message ?? "Product saved.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Product action failed.");
    } finally { setUploading(false); setLoading(false); }
  }

  async function archiveProduct(product: AdminProductListItem) {
    const response = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) { toast.error(payload?.message ?? "Product could not be archived."); return; }
    toast.success("Product archived.");
    setProductPatches((current) => ({ ...current, [product.id]: { status: "archived" } }));
  }

  async function updateProductVisibility(product: AdminProductListItem, status: "active" | "draft" | "archived") {
    const previousStatus = product.status ?? "active";
    setProductPatches((current) => ({ ...current, [product.id]: { status } }));
    const response = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partial: true, status }),
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
    const confirmed = window.confirm(`Permanently delete "${product.title}"? This removes it from the database and website. Use Archive instead if this product has order history.`);
    if (!confirmed) return;
    const response = await fetch(`/api/admin/products/${product.id}?permanent=true`, { method: "DELETE" });
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) { toast.error(payload?.message ?? "Product could not be permanently deleted."); return; }
    toast.success(payload?.message ?? "Product permanently deleted.");
    setProductPatches((current) => ({ ...current, [product.id]: null }));
  }

  return (
    <div>
      <section className="cos-section">
        <div className="cos-section-header">
          <div>
            <div className="cos-section-eyebrow">Catalog Intelligence</div>
            <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Products</h2>
            <p style={{ fontSize: "12px", color: "var(--cos-text-tertiary)", marginTop: "4px", maxWidth: "480px" }}>
              Search, publish, update, and archive products from one focused workspace.
            </p>
          </div>
          <span className="cos-tag cos-tag-accent">{pagination.total} total</span>
        </div>

        <div className="cos-metrics-strip">
          <MetricMini icon={Boxes} label="Total" value={stats.total} />
          <MetricMini icon={Eye} label="Active" value={stats.active} />
          <MetricMini icon={Archive} label="Draft" value={stats.draft} />
          <MetricMini icon={Tag} label="Low Stock" value={stats.lowStock} warn={stats.lowStock > 0} />
        </div>
      </section>

      <div className="cos-section" style={{ marginTop: "20px" }}>
        <div className="cos-section-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
            <div className="cos-search" style={{ maxWidth: "400px" }}>
              <Search style={{ width: 15, height: 15, color: "var(--cos-text-tertiary)", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search by name, SKU, brand..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <FilterChip active={categoryFilter === "all"} onClick={() => updateCategoryFilter("all")}>All</FilterChip>
              <FilterChip active={categoryFilter === "shoes"} onClick={() => updateCategoryFilter("shoes")}>Shoes</FilterChip>
              <FilterChip active={categoryFilter === "watches"} onClick={() => updateCategoryFilter("watches")}>Watches</FilterChip>
              <FilterChip active={statusFilter === "active"} onClick={() => updateStatusFilter(statusFilter === "active" ? "all" : "active")}>Active</FilterChip>
              <FilterChip active={statusFilter === "draft"} onClick={() => updateStatusFilter(statusFilter === "draft" ? "all" : "draft")}>Draft</FilterChip>
            </div>
            <Select className="cos-select" value={sortFilter} onChange={(e) => updateSortFilter(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="price-asc">Price low</option>
              <option value="price-desc">Price high</option>
              <option value="stock-asc">Stock low</option>
              <option value="stock-desc">Stock high</option>
            </Select>
          </div>
        </div>
      </div>

      <form className="cos-section" style={{ marginTop: "20px" }} onSubmit={submitProduct}>
        <div className="cos-section-header">
          <div>
            <div className="cos-section-eyebrow">{editingId ? "Editing" : "New Product"}</div>
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>{editingId ? "Update product" : "Add product"}</h2>
            <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>
              Photos, name, details, price, variants, and visibility.
            </p>
          </div>
          {editingId ? (
            <button type="button" className="cos-btn cos-btn-ghost" onClick={resetForm}>
              <RotateCcw style={{ width: 13, height: 13 }} /> New
            </button>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: "16px", padding: "16px" }} className="cos-grid-2">
          <CosFormSection index="1" title="Product photos" description="Upload clear front, side, and detail images.">
            <label className="cos-upload-area">
              <UploadCloud style={{ width: 24, height: 24, color: "var(--cos-text-tertiary)" }} />
              <span style={{ fontWeight: 700, fontSize: "13px" }}>
                {totalImageCount ? `${totalImageCount}/${maxProductImages} photos selected` : "Choose product photos"}
              </span>
              <span style={{ fontSize: "11px", color: "var(--cos-text-tertiary)" }}>
                JPG, PNG, or WebP. First image becomes the main photo.
              </span>
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="sr-only"
                disabled={loading || uploading}
                onChange={(event) => { chooseImages(event.target.files); event.currentTarget.value = ""; }}
              />
            </label>
            {imageError ? <p style={{ fontSize: "12px", color: "var(--cos-rose)", marginTop: "8px" }}>{imageError}</p> : null}
            {totalImageCount > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "8px", marginTop: "12px" }}>
                {currentImages.map((image) => (
                  <ImageThumb key={image} image={image} label="Saved" onRemove={() => removeSavedImage(image)} />
                ))}
                {selectedImagePreviews.map((image, index) => (
                  <ImageThumb key={image} image={image} label={index === 0 && currentImages.length === 0 ? "Main" : "New"} onRemove={() => removeSelectedImage(index)} unoptimized />
                ))}
              </div>
            )}
            {selectedImageFiles.length > 0 && (
              <button type="button" className="cos-btn cos-btn-ghost" style={{ marginTop: "8px" }} onClick={clearSelectedImage}>
                <X style={{ width: 12, height: 12 }} /> Clear selected
              </button>
            )}
          </CosFormSection>

          <CosFormSection index="2" title="Basic details" description="Name, brand, SKU, and listing URL.">
            <CosField label="Product name">
              <input className="cos-input" value={form.title} onChange={(e) => setTitle(e.target.value)} required />
            </CosField>
            <CosField label="Brand">
              <input className="cos-input" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </CosField>
            <CosField label="SKU">
              <input className="cos-input" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} required />
            </CosField>
            <CosField label="Slug">
              <input className="cos-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} required />
            </CosField>
          </CosFormSection>

          <CosFormSection index="3" title="Category mapping" description="Product wahi category page me dikhega jo yahan select karoge.">
            <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "1fr 1fr" }}>
              {mainCategories.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  className={`cos-tag ${form.category === category.value ? "cos-tag-accent" : ""}`}
                  style={{ padding: "12px", textAlign: "left", cursor: "pointer" }}
                  onClick={() => setMainCategory(category.value)}
                >
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>{category.label}</div>
                  <div style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>{category.description}</div>
                </button>
              ))}
            </div>
            <CosField label="Main category">
              <select className="cos-select" value={form.category} onChange={(e) => setMainCategory(e.target.value as ProductFormState["category"])}>
                <option value="shoes">Shoes</option>
                <option value="watches">Watches</option>
              </select>
            </CosField>
            <CosField label="Product subcategory">
              <select className="cos-select" value={form.subcategory} onChange={(e) => setProductType(e.target.value)}>
                {productTypes.filter((pt) => pt.category === form.category).map((pt) => (
                  <option key={pt.subcategory} value={pt.subcategory}>{pt.label}</option>
                ))}
              </select>
            </CosField>
            <CosField label="Target audience">
              <select className="cos-select" value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as typeof form.audience })}>
                <option value="">Auto-detect (from title/description)</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="unisex">Unisex / All</option>
              </select>
            </CosField>
          </CosFormSection>

          <CosFormSection index="4" title="Price, MRP, discount & stock" description="Customer price, compare price, discount, and quantity.">
            <CosField label="Price">
              <input className="cos-input" type="number" min="1" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </CosField>
            <CosField label="MRP">
              <input className="cos-input" type="number" min="0" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} />
            </CosField>
            <CosField label="Discount (%)">
              <input className="cos-input" type="number" min="0" value={form.discount_percent || discount} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
              <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "4px" }}>
                Auto-calculated from MRP and price when left empty. Current: {discount}% OFF.
              </p>
            </CosField>
            <CosField label="Stock quantity">
              <input className="cos-input" type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </CosField>
          </CosFormSection>

          <CosFormSection index="5" title="About product & variants" description="Customer-facing details and size/color options.">
            <CosField label="About product">
              <textarea className="cos-input" rows={3} value={form.short_description} onChange={(e) => setForm({ ...form, short_description: e.target.value })} />
            </CosField>
            <CosField label="Full product details">
              <textarea className="cos-input" rows={5} value={form.full_description} onChange={(e) => setForm({ ...form, full_description: e.target.value })} />
            </CosField>
            <CosField label="Sizes">
              <input className="cos-input" placeholder="7, 8, 9" value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} />
            </CosField>
            <CosField label="Colors">
              <input className="cos-input" placeholder="Black, White" value={form.colors} onChange={(e) => setForm({ ...form, colors: e.target.value })} />
            </CosField>
          </CosFormSection>

          <CosFormSection index="6" title="Visibility & highlights" description="Publish status and top placement badges.">
            <CosField label="Status">
              <select className="cos-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductFormState["status"] })}>
                <option value="active">Active — show on website</option>
                <option value="draft">Draft — hidden</option>
                <option value="archived">Archived — hidden</option>
              </select>
            </CosField>
            <CosToggle label="Top Featured" icon={Star} checked={form.featured} onChange={(featured) => setForm({ ...form, featured })} />
            <CosToggle label="Best Seller" icon={Sparkles} checked={form.bestseller} onChange={(bestseller) => setForm({ ...form, bestseller })} />
            <CosToggle label="New Arrival" icon={PackagePlus} checked={form.new_arrival} onChange={(new_arrival) => setForm({ ...form, new_arrival })} />
            <CosToggle label="Highlight in Header" icon={Zap} checked={form.highlighted} onChange={(highlighted) => setForm({ ...form, highlighted })} />
            {form.highlighted && currentImages.length > 0 && (
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "var(--cos-text-secondary)", marginBottom: "8px" }}>Hero slider image</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: "6px" }}>
                  {currentImages.map((image, index) => (
                    <button
                      key={image}
                      type="button"
                      className={`cos-img-thumb ${form.highlightedImageIndex === index ? "cos-img-thumb-active" : ""}`}
                      onClick={() => setForm({ ...form, highlightedImageIndex: index })}
                    >
                      <Image src={image} alt="" fill className="object-cover" unoptimized />
                      {form.highlightedImageIndex === index && <span className="cos-img-thumb-badge">Hero</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CosFormSection>

          <CosFormSection index="7" title="Advanced specifications JSON" description="Raw JSON for extra product data.">
            <CosField label="Specifications JSON">
              <textarea className="cos-input" rows={5} value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} />
            </CosField>
          </CosFormSection>
        </div>

        <div className="cos-form-footer">
          <button type="submit" className="cos-btn cos-btn-primary" disabled={loading || uploading}>
            <Sparkles style={{ width: 14, height: 14 }} />
            {uploading ? "Uploading photos..." : loading ? "Saving listing..." : editingId ? "Update product listing" : "Add product listing"}
          </button>
        </div>
      </form>

      <section className="cos-section" style={{ marginTop: "20px" }}>
        <div className="cos-section-header">
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Inventory list</h2>
            <p style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "2px" }}>
              {pagination.total} products found
            </p>
          </div>
        </div>

        <div style={{ padding: "8px" }}>
          {currentProducts.length > 0 ? (
            currentProducts.map((product) => (
              <article key={product.id} className="os-row">
                <div className="cos-product-thumb">
                  {product.image ? (
                    <Image src={product.image} alt={product.title} fill sizes="80px" loading="lazy" quality={60} className="object-cover" />
                  ) : (
                    <PackagePlus style={{ width: 24, height: 24, color: "var(--cos-text-tertiary)" }} />
                  )}
                </div>
                <div className="cos-product-info">
                  <div className="cos-product-title">
                    <span>{product.title}</span>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <span className={`cos-tag cos-tag-${product.status === "active" ? "emerald" : product.status === "draft" ? "amber" : "sky"}`}>
                        {product.status === "active" ? "Live" : product.status}
                      </span>
                      {product.stock <= 5 && <span className="cos-tag cos-tag-rose">Low stock</span>}
                    </div>
                  </div>
                  <div className="cos-product-meta">
                    {product.sku || "No SKU"} · {product.brand || "No brand"}
                  </div>
                  <div className="cos-product-tags">
                    <span className={`cos-tag cos-tag-${product.category === "shoes" ? "amber" : "accent"}`}>
                      {product.category}
                    </span>
                    {product.subcategory && <span className="cos-tag cos-tag-sky">{product.subcategory}</span>}
                    {product.featured && <span className="cos-tag cos-tag-accent">Featured</span>}
                    {product.bestseller && <span className="cos-tag cos-tag-emerald">Bestseller</span>}
                    {product.newArrival && <span className="cos-tag cos-tag-sky">New</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginTop: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--cos-text-primary)" }}>
                      ₹{product.price}
                    </span>
                    {product.discountPercent > 0 && (
                      <span className="cos-tag cos-tag-emerald">
                        {product.discountPercent}% OFF
                        {product.originalPrice > product.price && (
                          <span style={{ marginLeft: "6px", textDecoration: "line-through", opacity: 0.6 }}>₹{product.originalPrice}</span>
                        )}
                      </span>
                    )}
                    <StockBar stock={product.stock} />
                  </div>
                </div>
                <div className="cos-product-actions">
                  {product.status !== "active" ? (
                    <button type="button" className="cos-btn cos-btn-primary" onClick={() => updateProductVisibility(product, "active")}>
                      <Eye style={{ width: 13, height: 13 }} /> Publish
                    </button>
                  ) : (
                    <button type="button" className="cos-btn cos-btn-ghost" onClick={() => updateProductVisibility(product, "draft")}>
                      Hide
                    </button>
                  )}
                  <button type="button" className="cos-btn cos-btn-ghost" onClick={() => loadProductForEdit(product.id)}>
                    <Edit3 style={{ width: 13, height: 13 }} /> Edit
                  </button>
                  <button type="button" className="cos-btn cos-btn-ghost" onClick={() => archiveProduct(product)}>
                    <Archive style={{ width: 13, height: 13 }} /> Archive
                  </button>
                  <button type="button" className="cos-btn cos-btn-ghost" style={{ color: "var(--cos-rose)" }} onClick={() => permanentlyDeleteProduct(product)}>
                    <Trash2 style={{ width: 13, height: 13 }} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Search style={{ width: 32, height: 32, color: "var(--cos-text-tertiary)", margin: "0 auto 12px" }} />
              <p style={{ fontSize: "13px", color: "var(--cos-text-secondary)" }}>No products found</p>
            </div>
          )}
        </div>

        {pageCount > 1 && (
          <div className="cos-form-footer" style={{ justifyContent: "space-between" }}>
            <span style={{ fontSize: "12px", color: "var(--cos-text-tertiary)" }}>
              Showing {currentProducts.length} of {pagination.total}
            </span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button type="button" className="cos-btn cos-btn-ghost" disabled={currentPage <= 1} onClick={() => updateAdminProductsUrl({ page: String(currentPage - 1) })}>
                Previous
              </button>
              <span style={{ fontSize: "12px", color: "var(--cos-text-secondary)", fontFamily: "var(--cos-mono)" }}>
                Page {currentPage} of {pageCount}
              </span>
              <button type="button" className="cos-btn cos-btn-ghost" disabled={currentPage >= pageCount} onClick={() => updateAdminProductsUrl({ page: String(currentPage + 1) })}>
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CosFormSection({ index, title, description, children }: { index: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="cos-form-section">
      <div className="cos-form-section-header">
        <span className="cos-form-section-num">{index}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: "13px" }}>{title}</div>
          <div style={{ fontSize: "11px", color: "var(--cos-text-tertiary)", marginTop: "1px" }}>{description}</div>
        </div>
      </div>
      <div style={{ padding: "16px", display: "grid", gap: "12px" }}>{children}</div>
    </div>
  );
}

function CosField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "var(--cos-text-secondary)", marginBottom: "6px" }}>{label}</span>
      {children}
    </label>
  );
}

function CosToggle({
  icon: Icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="cos-toggle-row">
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <Icon style={{ width: 14, height: 14, color: checked ? "var(--cos-accent)" : "var(--cos-text-tertiary)" }} />
        <span style={{ fontSize: "13px", fontWeight: 600 }}>{label}</span>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--cos-accent)" }} />
    </label>
  );
}

function MetricMini({ icon: Icon, label, value, warn }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; warn?: boolean }) {
  return (
    <div className={`cos-metric-card ${warn ? "cos-metric-warn" : ""}`} style={{ padding: "12px" }}>
      <div className="cos-metric-icon" style={{ width: "28px", height: "28px" }}><Icon /></div>
      <div className="cos-metric-label" style={{ fontSize: "10px" }}>{label}</div>
      <div className="cos-metric-value" style={{ fontSize: "20px" }}>{value}</div>
    </div>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" className={`cos-chip ${active ? "active" : ""}`} onClick={onClick}>
      {children}
    </button>
  );
}

function StockBar({ stock }: { stock: number }) {
  const value = Math.max(0, Math.min(100, (stock / 30) * 100));
  return (
    <div style={{ minWidth: "80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", fontFamily: "var(--cos-mono)", color: "var(--cos-text-tertiary)" }}>
        <span>Stock</span><span>{stock}</span>
      </div>
      <div className="cos-progress-track" style={{ marginTop: "3px", height: "4px" }}>
        <span
          className="cos-progress-fill"
          style={{
            width: `${value}%`,
            background: stock <= 5 ? "var(--cos-rose)" : stock <= 15 ? "var(--cos-amber)" : "var(--cos-emerald)",
          }}
        />
      </div>
    </div>
  );
}

function ImageThumb({ image, label, onRemove, unoptimized = false }: { image: string; label: string; onRemove: () => void; unoptimized?: boolean }) {
  return (
    <div className="cos-img-thumb">
      <Image src={image} alt={label} fill sizes="80px" className="object-cover" unoptimized={unoptimized || image.startsWith("blob:")} />
      <span className="cos-img-thumb-badge">{label}</span>
      <button type="button" className="cos-img-thumb-remove" onClick={onRemove}>
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

function buildSku(title: string) {
  const prefix = slugify(title).split("-").slice(0, 3).join("-").toUpperCase();
  return prefix ? `DC-${prefix}-${Date.now().toString().slice(-4)}` : "";
}

async function uploadProductImage(file: File, productName: string) {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);
  const uploadFile = await compressImageForUpload(file);
  const formData = new FormData();
  formData.set("file", uploadFile);
  formData.set("slug", slugify(productName) || "product");
  const response = await fetch("/api/admin/uploads/product-image", { method: "POST", body: formData });
  const result = (await response.json().catch(() => null)) as { message?: string; url?: string } | null;
  if (!response.ok || !result?.url) throw new Error(result?.message ?? "Supabase image upload failed.");
  return result.url;
}

function validateImageFile(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) return "Please upload JPG, PNG, or WebP image only.";
  if (file.size > 5 * 1024 * 1024) return "Image must be smaller than 5 MB.";
  return null;
}

async function compressImageForUpload(file: File) {
  if (file.size <= 500 * 1024 || !file.type.startsWith("image/") || file.type === "image/webp") return file;
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
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => { canvas.toBlob(resolve, "image/webp", 0.78); });
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], replaceImageExtension(file.name, "webp"), { type: "image/webp", lastModified: Date.now() });
  } catch { return file; }
}

function replaceImageExtension(name: string, extension: string) { return name.replace(/\.[a-z0-9]+$/i, `.${extension}`); }
function toList(value: string) { return value.split(",").map((entry) => entry.trim()).filter(Boolean); }
function toImageList(value: string) { return value.split(/\r?\n|,/).map((entry) => entry.trim()).filter(Boolean); }
function parseSpecifications(value: string) {
  if (!value.trim()) return {};
  try { return JSON.parse(value) as Record<string, string>; } catch { throw new Error("Specifications JSON sahi format me nahi hai."); }
}
