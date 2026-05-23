import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/require-admin";

export async function GET(request: Request) {
  const result = await requireAdminApi(request);

  if (!result.ok) {
    return result.response;
  }

  return NextResponse.json({
    user: {
      id: result.admin.user.id,
      email: result.admin.user.email,
      role: result.admin.profile.role
    }
  });
}
