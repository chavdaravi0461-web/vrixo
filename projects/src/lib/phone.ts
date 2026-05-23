const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export function normalizeIndianMobileNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const digits = trimmedValue.replace(/\D/g, "");

  if (digits.length === 10 && INDIAN_MOBILE_REGEX.test(digits)) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    const localNumber = digits.slice(1);
    return INDIAN_MOBILE_REGEX.test(localNumber) ? `+91${localNumber}` : null;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    const localNumber = digits.slice(2);
    return INDIAN_MOBILE_REGEX.test(localNumber) ? `+91${localNumber}` : null;
  }

  return null;
}

export function isValidIndianMobileNumber(value: string) {
  return Boolean(normalizeIndianMobileNumber(value));
}

export function getIndianMobileLookupVariants(normalizedPhone: string) {
  const digits = normalizedPhone.replace(/\D/g, "");
  const localNumber = digits.startsWith("91") ? digits.slice(2) : digits;

  return Array.from(
    new Set([normalizedPhone, localNumber, `91${localNumber}`, `0${localNumber}`])
  );
}

export function formatIndianMobileNumber(normalizedPhone: string) {
  const digits = normalizedPhone.replace(/\D/g, "");
  const localNumber = digits.startsWith("91") ? digits.slice(2) : digits;

  if (!INDIAN_MOBILE_REGEX.test(localNumber)) {
    return normalizedPhone;
  }

  return `+91 ${localNumber.slice(0, 5)} ${localNumber.slice(5)}`;
}
