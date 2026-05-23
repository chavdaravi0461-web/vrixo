import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, expiredAdminCookieOptions } from "@/lib/admin-auth";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route";
import { logAdminAudit } from "@/lib/admin-audit";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  const supabase = createRouteHandlerSupabaseClient(request, response);

  await supabase.auth.signOut({ scope: "local" });
  response.cookies.set(ADMIN_COOKIE_NAME, "", expiredAdminCookieOptions());
  response.cookies.delete("dc_admin_gate");
  response.headers.set("Cache-Control", "no-store");

  await logAdminAudit({ request, action: "admin.logout" });

  return response;
}
