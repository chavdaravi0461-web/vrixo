import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportTicket, TicketReply } from "@/types";

export type CreateTicketInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  subject: string;
  description?: string | null;
  category?: string;
  source?: string;
  orderId?: string | null;
  orderNumber?: string | null;
  userId?: string | null;
};

export type TicketResult = {
  success: boolean;
  ticketId?: string;
  ticketNumber?: string;
  error?: string;
};

export async function createTicket(input: CreateTicketInput): Promise<TicketResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("create_support_ticket", {
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_customer_email: input.customerEmail ?? null,
    p_subject: input.subject,
    p_description: input.description ?? input.subject,
    p_category: input.category ?? "general",
    p_source: input.source ?? "web",
    p_order_id: input.orderId ?? null,
    p_order_number: input.orderNumber ?? null,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const ticketId = String(data);

  if (input.userId) {
    await supabase
      .from("support_tickets")
      .update({ user_id: input.userId })
      .eq("id", ticketId);
  }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("ticket_number")
    .eq("id", ticketId)
    .maybeSingle();

  return {
    success: true,
    ticketId,
    ticketNumber: ticket?.ticket_number as string,
  };
}

export async function addTicketReply(
  ticketId: string,
  input: {
    userId?: string | null;
    authorName: string;
    authorRole: "customer" | "admin" | "system";
    isAdmin: boolean;
    message: string;
    internalNote?: boolean;
  }
): Promise<TicketResult> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("ticket_replies").insert({
    ticket_id: ticketId,
    user_id: input.userId ?? null,
    author_name: input.authorName,
    author_role: input.authorRole,
    is_admin: input.isAdmin,
    message: input.message,
    internal_note: input.internalNote ?? false,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  const statusUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.isAdmin && input.authorRole === "admin") {
    statusUpdate.status = "waiting_on_customer";
    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("first_response_at")
      .eq("id", ticketId)
      .maybeSingle();
    if (!ticket?.first_response_at) {
      statusUpdate.first_response_at = new Date().toISOString();
    }
  } else if (!input.isAdmin) {
    statusUpdate.status = "waiting_on_admin";
  }

  await supabase.from("support_tickets").update(statusUpdate).eq("id", ticketId);

  return { success: true, ticketId };
}

export async function getTickets(options: {
  status?: string;
  phone?: string;
  userId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<SupportTicket[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(options.limit ?? 50, 100))
    .range(options.offset ?? 0, (options.offset ?? 0) + Math.min(options.limit ?? 50, 100) - 1);

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }
  if (options.phone) {
    query = query.eq("customer_phone", options.phone);
  }
  if (options.userId) {
    query = query.eq("user_id", options.userId);
  }

  const { data } = await query;
  return (data ?? []).map(mapTicket);
}

export async function getTicketById(ticketId: string): Promise<SupportTicket | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();
  return data ? mapTicket(data) : null;
}

export async function getTicketReplies(ticketId: string): Promise<TicketReply[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("ticket_replies")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    ticketId: String(r.ticket_id),
    userId: r.user_id ? String(r.user_id) : null,
    authorName: String(r.author_name),
    authorRole: r.author_role as TicketReply["authorRole"],
    isAdmin: Boolean(r.is_admin),
    message: String(r.message),
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    internalNote: Boolean(r.internal_note),
    createdAt: String(r.created_at),
  }));
}

export async function updateTicketStatus(
  ticketId: string,
  status: string,
  adminUserId?: string
): Promise<TicketResult> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "resolved") updates.resolved_at = new Date().toISOString();
  if (status === "closed") updates.closed_at = new Date().toISOString();
  if (adminUserId) updates.assigned_to = adminUserId;

  const { error } = await supabase.from("support_tickets").update(updates).eq("id", ticketId);
  if (error) return { success: false, error: error.message };
  return { success: true, ticketId };
}

function mapTicket(row: Record<string, unknown>): SupportTicket {
  return {
    id: String(row.id),
    ticketNumber: String(row.ticket_number),
    userId: row.user_id ? String(row.user_id) : null,
    customerName: String(row.customer_name),
    customerPhone: String(row.customer_phone),
    customerEmail: row.customer_email ? String(row.customer_email) : null,
    subject: String(row.subject),
    description: String(row.description),
    category: row.category as SupportTicket["category"],
    priority: row.priority as SupportTicket["priority"],
    status: row.status as SupportTicket["status"],
    assignedTo: row.assigned_to ? String(row.assigned_to) : null,
    source: row.source as SupportTicket["source"],
    orderId: row.order_id ? String(row.order_id) : null,
    orderNumber: row.order_number ? String(row.order_number) : null,
    firstResponseAt: row.first_response_at ? String(row.first_response_at) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
    closedAt: row.closed_at ? String(row.closed_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
