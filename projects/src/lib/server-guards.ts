import { requireAdminApi as requireAdminApiResult } from "@/lib/require-admin";

export async function requireAdminApi(request: Request) {
  const result = await requireAdminApiResult(request);
  return result.ok ? null : result.response;
}
