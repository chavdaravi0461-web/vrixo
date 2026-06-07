import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTicket, getTickets } from "@/lib/support/tickets";
import { checkServerRateLimit } from "@/lib/rate-limit";
import { tooManyRequests } from "@/lib/api-response";
import { safeRoute } from "@/lib/safe-route";

export const GET = safeRoute(async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Please login to view tickets." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", user.id)
    .maybeSingle();

  const tickets = await getTickets({
    userId: user.id,
    phone: profile?.phone as string | undefined,
    limit: 50,
  });

  return NextResponse.json({ tickets });
});

export const POST = safeRoute(async function POST(request: Request) {
  const rateLimit = await checkServerRateLimit(request, {
    key: "support-ticket-create",
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) return tooManyRequests(rateLimit.retryAfter);

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  const body = await request.json();
  const { subject, description, category, orderId, orderNumber } = body;

  if (!subject || typeof subject !== "string" || subject.trim().length === 0) {
    return NextResponse.json({ message: "Subject is required." }, { status: 400 });
  }

  let customerName = "Guest";
  let customerPhone = "";
  let userId: string | null = null;

  if (user) {
    userId = user.id;
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, phone")
      .eq("id", user.id)
      .maybeSingle();

    customerName = (profile?.name as string) || user.email?.split("@")[0] || "Customer";
    customerPhone = (profile?.phone as string) || "";
  } else {
    customerName = body.customerName || "Guest";
    customerPhone = body.customerPhone || "";
    if (!customerPhone) {
      return NextResponse.json({ message: "Phone number is required for guest tickets." }, { status: 400 });
    }
  }

  const result = await createTicket({
    customerName,
    customerPhone,
    subject: subject.trim(),
    description: description?.trim() || subject.trim(),
    category: category || "general",
    source: "web",
    orderId: orderId || null,
    orderNumber: orderNumber || null,
    userId,
  });

  if (!result.success) {
    return NextResponse.json({ message: result.error || "Failed to create ticket." }, { status: 500 });
  }

  return NextResponse.json({
    message: "Support ticket created successfully.",
    ticketId: result.ticketId,
    ticketNumber: result.ticketNumber,
  });
});
