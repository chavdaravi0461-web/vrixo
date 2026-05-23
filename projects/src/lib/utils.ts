import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { hasClientSupabaseEnv, hasRazorpayClientEnv } from "@/lib/env/client";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0
  }).format(value);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function makeOrderNumber() {
  const segment = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DC-${Date.now().toString().slice(-6)}-${segment}`;
}

export function cleanProductTitle(value: string) {
  return toReadableProductText(value)
    .replace(/\bhot selling\b/gi, "")
    .replace(/\bfix price\b/gi, "")
    .replace(/\bno less\b/gi, "")
    .replace(/\bavailable in\b.*$/gi, "")
    .replace(/\s*@\s*[\d,./-]+.*$/g, "")
    .replace(/\bprice\s*[-:]?\s*rs\.?\s*[\d,./-]+/gi, "")
    .replace(/\bmen s\b/gi, "Men's")
    .replace(/\bwomen s\b/gi, "Women's")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanProductDescription(value: string) {
  const cleaned = toReadableProductText(value)
    .replace(/\s*@\s*rs\.?\s*[\d,./-]+/gi, "")
    .replace(/\s*@\s*[\d,./-]+/g, "")
    .replace(/\bavailable\s*@.*$/gi, "")
    .replace(/\bprice\s*[-:]?\s*rs\.?\s*[\d,./-]+/gi, "")
    .replace(/\bfix price\b/gi, "")
    .replace(/\bno less\b/gi, "")
    .replace(/\ball self clicked picture and video\b/gi, "")
    .replace(/\bwrkng\b/gi, "working")
    .replace(/\bcrono\b/gi, "chrono")
    .replace(/\bmodal\b/gi, "model")
    .replace(/\bmen s\b/gi, "Men's")
    .replace(/\bwomen s\b/gi, "Women's")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "A stylish Vrixo pick with dependable everyday quality.";
}

function toReadableProductText(value: string) {
  const normalized = value
    .replace(/#/g, ". ")
    .replace(/\s*[-–]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const letters = normalized.replace(/[^a-z]/gi, "");
  const uppercaseLetters = normalized.replace(/[^A-Z]/g, "");
  const mostlyUppercase = letters.length > 0 && uppercaseLetters.length / letters.length > 0.72;

  if (!mostlyUppercase) {
    return normalized;
  }

  return normalized.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function isSupabaseConfigured() {
  return hasClientSupabaseEnv();
}

export function isRazorpayClientConfigured() {
  return hasRazorpayClientEnv();
}
