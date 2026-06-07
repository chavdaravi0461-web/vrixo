const INDIAN_PHONE_REGEX = /^[6-9]\d{9}$/;

export function formatWhatsAppPhone(value: string): string {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (digits.length === 10) {
    if (!INDIAN_PHONE_REGEX.test(digits)) return "";
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    const stripped = digits.slice(1);
    if (!INDIAN_PHONE_REGEX.test(stripped)) return "";
    return `+91${stripped}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    const stripped = digits.slice(2);
    if (!INDIAN_PHONE_REGEX.test(stripped)) return "";
    return `+91${stripped}`;
  }

  const lastTen = digits.slice(-10);
  if (INDIAN_PHONE_REGEX.test(lastTen)) return `+91${lastTen}`;

  return "";
}

export function sanitizeCustomerPhone(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10 && INDIAN_PHONE_REGEX.test(digits)) {
    return digits;
  }

  if (digits.length > 10 && digits.startsWith("0")) {
    const stripped = digits.slice(1);
    if (stripped.length === 10 && INDIAN_PHONE_REGEX.test(stripped)) return stripped;
  }

  if (digits.length > 10 && digits.startsWith("91")) {
    const stripped = digits.slice(2);
    if (stripped.length === 10 && INDIAN_PHONE_REGEX.test(stripped)) return stripped;
  }

  const lastTen = digits.slice(-10);
  return INDIAN_PHONE_REGEX.test(lastTen) ? lastTen : "";
}

export function isValidIndianWhatsAppPhone(value: string): boolean {
  return formatWhatsAppPhone(value).length === 13;
}

export function toWhatsAppCloudRecipient(value: string): string {
  return formatWhatsAppPhone(value).replace(/^\+/, "");
}
