/**
 * Formats Indian mobile numbers for WhatsApp Cloud API (digits only, country code 91).
 * Accepts: 9876543210, 09876543210, +91 98765 43210, 919876543210
 */
export function formatWhatsAppPhone(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return "";
}

/** Trims and strips unsafe characters from checkout phone input. */
export function sanitizeCustomerPhone(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw.replace(/[^\d+\s-]/g, "").slice(0, 20);
}

export function isValidIndianWhatsAppPhone(value: string) {
  return formatWhatsAppPhone(value).length === 12;
}
