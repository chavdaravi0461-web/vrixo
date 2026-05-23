import { getAppUrl } from "@/lib/app-url";

export function getCanonicalAppUrl() {
  return getAppUrl();
}

export function getCanonicalHost() {
  try {
    return new URL(getCanonicalAppUrl()).host;
  } catch {
    return "www.vrixo.in";
  }
}
