-- ============================================================
-- DIAGNOSTIC: Why is checkout failing with "Something went wrong"?
-- Run this in Supabase SQL Editor and share results
-- ============================================================

-- 1. Check if orders table exists and its structure
SELECT 
  'orders table exists' as check_name,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='orders') as result;

-- 2. List ALL columns in orders table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'orders'
ORDER BY ordinal_position;

-- 3. Check if idempotency_key column exists
SELECT 
  'idempotency_key column exists' as check_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='idempotency_key') as result;

-- 4. Check RLS status on orders
SELECT 
  tablename, 
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' AND tablename IN ('orders', 'order_items', 'payments', 'addresses', 'profiles');

-- 5. List ALL policies on orders table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'orders'
ORDER BY policyname;

-- 6. List ALL policies on order_items table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'order_items'
ORDER BY policyname;

-- 7. List ALL policies on payments table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'payments'
ORDER BY policyname;

-- 8. Check CHECK constraints on orders
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'orders'::regclass AND contype = 'c';

-- 9. Check foreign key constraints on orders
SELECT conname, pg_get_constraintdef(oid) as constraint_def
FROM pg_constraint
WHERE conrelid = 'orders'::regclass AND contype = 'f';

-- 10. Check if there are any recent order attempts (last 24h)
SELECT id, order_number, order_status, payment_status, created_at
FROM orders 
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC 
LIMIT 10;

-- 11. Check profiles table - any profiles exist?
SELECT COUNT(*) as total_profiles FROM profiles;

-- 12. Check if service_role can access orders (bypassing RLS)
SET ROLE service_role;
SELECT COUNT(*) as service_role_order_count FROM orders;
RESET ROLE;

-- 13. Check the orders RLS insert policy specifically
SELECT 
  policyname, 
  cmd,
  roles,
  qual as using_expr,
  with_check as check_expr
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'orders' 
  AND cmd = 'INSERT';

-- 14. Check if the idempotency_key index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'orders'
  AND indexname LIKE '%idempotency%';

-- 15. Check the order_items product_id column type
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id';

-- 16. Verify security.sql policies were applied
SELECT 
  'orders_insert_own exists' as check_name,
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_insert_own') as result
UNION ALL
SELECT 
  'orders_admin_manage exists' as check_name,
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_admin_manage') as result
UNION ALL
SELECT 
  'schema_orders_select_own exists' as check_name,
  EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='orders_select_own') as result;
