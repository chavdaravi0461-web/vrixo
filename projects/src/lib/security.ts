import { NextResponse } from "next/server";
import { z } from "zod";
import { isLocalFilePath, isSafeProductImageUrl } from "@/lib/product-images";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();

export const secureCartItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID."),
  slug: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(240),
  image: z
    .string()
    .trim()
    .max(1200)
    .optional()
    .default("")
    .refine((value) => !value || (!isLocalFilePath(value) && isSafeProductImageUrl(value)), {
      message: "Invalid product image."
    }),
  price: z.coerce.number().finite().nonnegative(),
  quantity: z.coerce.number().int().min(1).max(10),
  stock: z.coerce.number().int().min(0).max(100000).optional().default(0),
  selectedSize: z.string().trim().max(40).optional(),
  selectedColor: z.string().trim().max(60).optional()
});

export const secureCartItemsSchema = z.array(secureCartItemSchema).min(1).max(50);

export function checkRateLimit(request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const ip = getClientIp(request);
  const key = `${options.key}:${ip}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return null;
  }

  if (current.count >= options.limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { message: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter)
        }
      }
    );
  }

  current.count += 1;
  return null;
}

export function sanitizePlainText(value: unknown, maxLength = 5000) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function securityLog(event: string, details: Record<string, unknown> = {}) {
  console.info(`[security] ${event}`, {
    ...details,
    at: new Date().toISOString()
  });
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
