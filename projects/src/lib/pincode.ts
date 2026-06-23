export type PincodeLookupResult = {
  pincode: string;
  city: string;
  district?: string;
  state: string;
  country: string;
  source: "api" | "cache" | "fallback";
};

const CACHE_PREFIX = "vrixo:pincode:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

function getCacheKey(pin: string) {
  return `${CACHE_PREFIX}${pin}`;
}

function readCache(pin: string): PincodeLookupResult | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getCacheKey(pin));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; data: PincodeLookupResult };
    if (!parsed?.ts || !parsed?.data) return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) {
      window.localStorage.removeItem(getCacheKey(pin));
      return null;
    }
    return { ...parsed.data, source: "cache" };
  } catch {
    return null;
  }
}

function writeCache(pin: string, data: PincodeLookupResult) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(getCacheKey(pin), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

export async function fetchPincodeFromApi(pin: string): Promise<PincodeLookupResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`https://api.postalpincode.in/pincode/${encodeURIComponent(pin)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const json = await res.json();
    if (!Array.isArray(json) || json.length === 0) return null;
    const entry = json[0];
    if (!entry || entry.Status !== "Success" || !Array.isArray(entry.PostOffice) || entry.PostOffice.length === 0) return null;
    const po = entry.PostOffice[0];
    const result: PincodeLookupResult = {
      pincode: pin,
      city: po?.Name || po?.Division || "",
      district: po?.District || "",
      state: po?.State || "",
      country: po?.Country || "India",
      source: "api"
    };
    writeCache(pin, result);
    return result;
  } catch {
    return null;
  }
}

export function getFallbackPincode(pin: string): PincodeLookupResult {
  return {
    pincode: pin,
    city: "",
    state: "",
    country: "India",
    source: "fallback",
  };
}

export async function lookupPincode(pin: string): Promise<PincodeLookupResult | null> {
  if (!/^[0-9]{6}$/.test(pin)) return null;
  const cached = readCache(pin);
  if (cached) return cached;
  const api = await fetchPincodeFromApi(pin);
  return api;
}
