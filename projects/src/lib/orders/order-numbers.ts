/**
 * Normalizes order numbers for URLs and database lookups.
 * Prevents "Page not found" when order IDs contain encoded characters.
 */

const ORDER_NUMBER_PATTERN = /^[A-Z0-9-]+$/i;

export function normalizeOrderNumber(value: string) {
  return decodeOrderNumberParam(value)
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function decodeOrderNumberParam(raw: string) {
  let value = String(raw ?? "").trim();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!value.includes("%")) {
      break;
    }

    try {
      const decoded = decodeURIComponent(value);
      if (decoded === value) {
        break;
      }
      value = decoded;
    } catch {
      break;
    }
  }

  return value;
}

export function isValidOrderNumber(value: string) {
  return ORDER_NUMBER_PATTERN.test(value) && value.length >= 8 && value.length <= 64;
}

export function orderNumberToPathSegment(orderNumber: string) {
  const normalized = normalizeOrderNumber(orderNumber);
  if (!isValidOrderNumber(normalized)) {
    throw new Error("Invalid order number format.");
  }
  return normalized;
}
