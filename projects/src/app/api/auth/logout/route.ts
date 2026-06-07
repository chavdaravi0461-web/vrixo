import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, expiredAdminCookieOptions } from "@/lib/admin-auth";
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route";
import { isSupabaseConfigured } from "@/lib/utils";
import { safeRoute } from "@/lib/safe-route";

export const POST = safeRoute(async function POST(request: NextRequest) {
  const response = NextResponse.json({
    success: true
  });
  response.cookies.set(ADMIN_COOKIE_NAME, "", expiredAdminCookieOptions());
  response.cookies.delete("dc_admin_gate");

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createRouteHandlerSupabaseClient(request, response);
  await supabase.auth.signOut({
    scope: "local"
  });

  return response;
});
