export const ADMIN_EMAIL = "chavdaravi0461@gmail.com";
export const PRIVATE_ADMIN_PATH = "/dashboard-admin-dreamcart-ravi";
export const LEGACY_ADMIN_PATHS = ["/admin", "/dreamcart-owner-panel"];

export function normalizeAdminEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

export function isOwnerAdminEmail(value?: string | null) {
  return normalizeAdminEmail(value) === ADMIN_EMAIL;
}
