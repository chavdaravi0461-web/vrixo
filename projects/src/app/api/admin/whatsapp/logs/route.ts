import { NextResponse } from "next/server";
import { getWhatsAppRecentLogs } from "@/services/notifications/whatsapp-log-store";
import { requireAnyHeaderSecret } from "@/lib/server/secret-guard";

export async function GET(request: Request) {
  const authError = requireAnyHeaderSecret(request, ["x-admin-key", "x-server-key"], [
    process.env.ADMIN_API_KEY,
    process.env.WHATSAPP_ADMIN_SECRET
  ]);
  if (authError) return authError;

  try {
    const rows = await getWhatsAppRecentLogs(200);
    return NextResponse.json({ data: rows });
  } catch (err) {
    return NextResponse.json({ message: "Failed to fetch logs" }, { status: 500 });
  }
}
