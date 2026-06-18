import { NextResponse } from "next/server";
import { hasServerSupabaseAdminEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/require-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authResult = await requireAdminApi(request);
  if (!authResult.ok) return authResult.response;

  const checks: Record<string, unknown> = {};
  const errors: string[] = [];

  // 1. Environment variables
  checks.env = {
    clientSupabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serverSupabase: hasServerSupabaseAdminEnv(),
    supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    razorpayKey: !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    whatsappToken: !!process.env.WHATSAPP_CLOUD_API_TOKEN,
  };

  // 2. Admin client connectivity
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("orders")
      .select("id, order_number")
      .limit(1);
    if (error) {
      errors.push(`admin_query: ${error.code} - ${error.message}`);
      checks.adminClient = { ok: false, error: error.message, code: error.code };
    } else {
      checks.adminClient = { ok: true, sampleOrders: data?.length ?? 0 };
    }
  } catch (e: any) {
    errors.push(`admin_client_exception: ${e?.message}`);
    checks.adminClient = { ok: false, error: e?.message };
  }

  // 3. Check orders table structure
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("orders")
      .select("id")
      .limit(0);
    if (error) {
      errors.push(`orders_select: ${error.code} - ${error.message}`);
      checks.ordersTable = { ok: false, error: error.message, code: error.code };
    } else {
      checks.ordersTable = { ok: true };
    }
  } catch (e: any) {
    checks.ordersTable = { ok: false, error: e?.message };
  }

  // 4. Check profiles table
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) {
      errors.push(`profiles_count: ${error.code} - ${error.message}`);
    }
    checks.profilesCount = count ?? "error";
  } catch (e: any) {
    checks.profilesCount = "exception";
  }

  // 5. Check order_items table
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("order_items")
      .select("id")
      .limit(0);
    if (error) {
      errors.push(`order_items_select: ${error.code} - ${error.message}`);
      checks.orderItemsTable = { ok: false, error: error.message, code: error.code };
    } else {
      checks.orderItemsTable = { ok: true };
    }
  } catch (e: any) {
    checks.orderItemsTable = { ok: false, error: e?.message };
  }

  // 6. Check payments table
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("payments")
      .select("id")
      .limit(0);
    if (error) {
      errors.push(`payments_select: ${error.code} - ${error.message}`);
      checks.paymentsTable = { ok: false, error: error.message, code: error.code };
    } else {
      checks.paymentsTable = { ok: true };
    }
  } catch (e: any) {
    checks.paymentsTable = { ok: false, error: e?.message };
  }

  // 7. Check products table
  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("products")
      .select("id", { count: "exact", head: true });
    if (error) {
      errors.push(`products_count: ${error.code} - ${error.message}`);
    }
    checks.productsCount = count ?? "error";
  } catch (e: any) {
    checks.productsCount = "exception";
  }

  // 8. Test a dry-run insert into orders (using a test idempotency key, then immediately delete)
  try {
    const admin = createAdminClient();
    const testId = crypto.randomUUID();
    const testOrderId = crypto.randomUUID();
    const { error: insertError } = await admin
      .from("orders")
      .insert({
        id: testOrderId,
        order_number: `TEST-${Date.now()}`,
        user_id: "00000000-0000-0000-0000-000000000000",
        items: [],
        subtotal: 0,
        discount: 0,
        shipping_charge: 0,
        total: 0,
        total_amount: 0,
        payment_method: "cod",
        payment_status: "cod_pending",
        order_status: "pending",
        shipping_address: {},
        customer_name: "TEST DELETE ME",
        customer_phone: "0000000000",
        customer_email: "test-delete-me@test.com",
        whatsapp_status: "pending",
        idempotency_key: testId,
        notes: {}
      })
      .select("id")
      .single();

    if (insertError) {
      errors.push(`test_insert: ${insertError.code} - ${insertError.message}`);
      checks.testInsert = { ok: false, error: insertError.message, code: insertError.code, details: insertError.details, hint: insertError.hint };
    } else {
      // Clean up the test row
      await admin.from("orders").delete().eq("id", testOrderId);
      checks.testInsert = { ok: true, message: "Dry-run insert succeeded (test row cleaned up)" };
    }
  } catch (e: any) {
    checks.testInsert = { ok: false, error: "Test insert failed" };
  }

  // 9. Test a dry-run insert with a REAL profile user_id (find first customer)
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("role", "customer")
      .limit(1)
      .maybeSingle();

    if (profile?.id) {
      const testId2 = crypto.randomUUID();
      const testOrderId2 = crypto.randomUUID();
      const { error: insertError2 } = await admin
        .from("orders")
        .insert({
          id: testOrderId2,
          order_number: `TEST2-${Date.now()}`,
          user_id: profile.id,
          items: [],
          subtotal: 0,
          discount: 0,
          shipping_charge: 0,
          total: 0,
          total_amount: 0,
          payment_method: "cod",
          payment_status: "cod_pending",
          order_status: "pending",
          shipping_address: { fullName: "Test", phone: "9000000000", line1: "Test", city: "Test", state: "Test", postalCode: "110001", country: "India" },
          customer_name: "TEST DELETE ME 2",
          customer_phone: "9000000000",
          customer_email: "test-delete-me2@test.com",
          whatsapp_status: "pending",
          idempotency_key: testId2,
          notes: {}
        })
        .select("id")
        .single();

      if (insertError2) {
        errors.push(`test_insert_real_user: ${insertError2.code} - ${insertError2.message}`);
        checks.testInsertRealUser = { ok: false, error: insertError2.message, code: insertError2.code, details: insertError2.details, hint: insertError2.hint };
      } else {
        await admin.from("orders").delete().eq("id", testOrderId2);
        checks.testInsertRealUser = { ok: true, message: "Dry-run insert with real user succeeded" };
      }
    } else {
      checks.testInsertRealUser = { skipped: true, message: "No customer profiles found" };
    }
  } catch (e: any) {
    checks.testInsertRealUser = { ok: false, error: e?.message };
  }

  return NextResponse.json({
    status: errors.length > 0 ? "HAS_ERRORS" : "ALL_OK",
    errors,
    checks,
    timestamp: new Date().toISOString(),
  }, { status: 200 });
}
