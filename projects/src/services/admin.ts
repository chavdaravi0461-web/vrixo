import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsSummary } from "@/types/index";

export async function getAdminSummary(): Promise<AnalyticsSummary> {
  const supabase = createAdminClient();
  const { data: rpcData, error: rpcError } = await supabase.rpc("get_admin_dashboard_stats");

  if (!rpcError && rpcData && typeof rpcData === "object") {
    const stats = rpcData as Record<string, unknown>;
    return {
      totalProducts: Number(stats.totalProducts ?? 0),
      totalOrders: Number(stats.totalOrders ?? 0),
      totalUsers: Number(stats.totalUsers ?? 0),
      totalRevenue: Number(stats.totalRevenue ?? 0),
      lowStockCount: Number(stats.lowStockProducts ?? 0),
      newContacts: Number(stats.newContacts ?? 0),
      pendingOrders: Number(stats.pendingOrders ?? 0),
      paidOrders: Number(stats.onlinePaidOrders ?? 0),
      codOrders: Number(stats.codOrders ?? 0),
      todayOrders: Number(stats.todayOrders ?? 0),
      todayRevenue: Number(stats.todayRevenue ?? 0),
      completedOrders: Number(stats.completedOrders ?? 0),
      activeProducts: Number(stats.activeProducts ?? 0),
      pendingNotifications: Number(stats.pendingNotifications ?? 0),
      failedNotifications: Number(stats.failedNotifications ?? 0)
    };
  }

  const [
    { count: totalProducts },
    { count: totalOrders },
    { count: totalUsers },
    ordersResult,
    { count: lowStockCount },
    { count: pendingNotifications },
    { count: failedNotifications }
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("total, order_status, payment_status, payment_method, created_at"),
    supabase.from("products").select("id", { count: "exact", head: true }).lte("stock", 5),
    supabase.from("order_notifications").select("id", { count: "exact", head: true }).or("status.eq.pending,status.eq.retry_scheduled"),
    supabase.from("order_notifications").select("id", { count: "exact", head: true }).eq("status", "failed")
  ]);

  const newContactsResult = await supabase
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  const fallbackContactsResult = newContactsResult.error
    ? await supabase.from("contact_messages").select("id", { count: "exact", head: true })
    : null;

  const orderRows = ordersResult.data ?? [];

  return {
    totalProducts: totalProducts ?? 0,
    totalOrders: totalOrders ?? 0,
    totalUsers: totalUsers ?? 0,
    totalRevenue: orderRows
      .filter((order) => order.order_status !== "Cancelled")
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0),
    lowStockCount: lowStockCount ?? 0,
    newContacts: newContactsResult.count ?? fallbackContactsResult?.count ?? 0,
    pendingOrders: orderRows.filter((order) => String(order.order_status).toLowerCase() === "pending").length,
    paidOrders: orderRows.filter((order) => String((order as { payment_status?: string }).payment_status).toLowerCase() === "paid").length,
    codOrders: orderRows.filter((order) => String((order as { payment_method?: string }).payment_method).toLowerCase() === "cod").length,
    todayOrders: orderRows.filter((order) => {
      const createdAt = (order as { created_at?: string }).created_at;
      return createdAt ? new Date(createdAt).toDateString() === new Date().toDateString() : false;
    }).length,
    todayRevenue: orderRows
      .filter((order) => {
        const createdAt = (order as { created_at?: string }).created_at;
        return createdAt ? new Date(createdAt).toDateString() === new Date().toDateString() : false;
      })
      .filter((order) => order.order_status !== "Cancelled")
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0),
    completedOrders: orderRows.filter((order) => String(order.order_status).toLowerCase() === "delivered").length,
    activeProducts: totalProducts ?? 0,
    pendingNotifications: pendingNotifications ?? 0,
    failedNotifications: failedNotifications ?? 0
  };
}
