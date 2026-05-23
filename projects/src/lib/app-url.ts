const LOCAL_APP_URL = "http://localhost:3000";
const PUBLIC_APP_URL = "https://www.vrixo.in";

export function getAppUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (configuredUrl) {
    return normalizeUrl(configuredUrl);
  }

  if (process.env.NODE_ENV === "production") {
    return PUBLIC_APP_URL;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return normalizeUrl(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  if (process.env.VERCEL_URL) {
    return normalizeUrl(`https://${process.env.VERCEL_URL}`);
  }

  return LOCAL_APP_URL;
}

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, "");
}
