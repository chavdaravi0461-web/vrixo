import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";
import { requireSameOrigin } from "@/lib/server/origin-check";
import { serverError } from "@/lib/api-response";

const bucket = "product-images";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

export async function POST(request: Request) {
  const guard = await requireAdminApi(request);
  if (guard) return guard;
  const originError = requireSameOrigin(request);
  if (originError) return originError;

  const formData = await request.formData();
  const file = formData.get("file");
  const slug = slugify(String(formData.get("slug") ?? "product"));

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image file is required." }, { status: 400 });
  }

  const extension = getExtension(file);

  if (!allowedTypes.has(file.type) || !allowedExtensions.has(extension)) {
    return NextResponse.json(
      { message: "Upload a JPG, PNG, or WebP image." },
      { status: 400 }
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: "Image must be smaller than 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!hasValidImageSignature(buffer, file.type)) {
    return NextResponse.json({ message: "Invalid image file." }, { status: 400 });
  }

  const randomId = crypto.randomUUID();
  const path = `products/${slug || "product"}/${slug || "product"}-${Date.now()}-${randomId}.${extension}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false
  });

  if (error) {
    return serverError(
      error.message.includes("Bucket not found")
        ? "Product image storage is not configured."
        : "Image upload failed."
    );
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}

function getExtension(file: File) {
  const byType = file.type.split("/")[1];
  const byName = file.name.split(".").pop();
  const extension = (byName || byType || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension === "jpeg" ? "jpg" : extension || "jpg";
}

function hasValidImageSignature(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  if (mimeType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}
