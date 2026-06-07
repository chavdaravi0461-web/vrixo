/*
Vrixo Supabase Security Verification

Run this after supabase/security.sql.
This file is read-only. It does not modify tables, users, products, orders, or storage objects.

Expected result:
- Sensitive public tables have RLS enabled.
- Canonical policies exist.
- public.is_admin() and role protection trigger exist.
- product-images storage bucket allows public read but admin-only write.
- No obvious public write policy exists for sensitive tables.
*/

-- 1. RLS status for important public tables.
with expected_tables(table_name, required) as (
  values
    ('profiles', true),
    ('products', true),
    ('categories', true),
    ('product_images', false),
    ('addresses', false),
    ('cart_items', false),
    ('wishlists', false),
    ('product_reviews', false),
    ('coupons', false),
    ('orders', true),
    ('order_items', true),
    ('payments', false),
    ('newsletter_subscriptions', false),
    ('newsletter_subscribers', false),
    ('contact_messages', false),
    ('contacts', false),
    ('game_sessions', false),
    ('daily_game_rewards', false),
    ('phone_otp_requests', false),
    ('admin_audit_logs', true),
    ('admin_rate_limits', true),
    ('rate_limits', true),
    ('razorpay_webhook_events', true)
)
select
  'RLS enabled: public.' || e.table_name as check_name,
  case
    when c.oid is null and e.required then 'FAIL'
    when c.oid is null and not e.required then 'SKIP'
    when c.relrowsecurity then 'PASS'
    else 'FAIL'
  end as result,
  case
    when c.oid is null then 'table not found'
    when c.relrowsecurity then 'row level security is enabled'
    else 'row level security is disabled'
  end as detail
from expected_tables e
left join pg_class c
  on c.relname = e.table_name
left join pg_namespace n
  on n.oid = c.relnamespace
 and n.nspname = 'public'
order by e.table_name;

-- 2. Helper functions exist.
select
  'Function exists: public.is_admin()' as check_name,
  case when to_regprocedure('public.is_admin()') is not null then 'PASS' else 'FAIL' end as result,
  coalesce(to_regprocedure('public.is_admin()')::text, 'missing') as detail
union all
select
  'Function exists: public.is_admin(uuid)',
  case when to_regprocedure('public.is_admin(uuid)') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regprocedure('public.is_admin(uuid)')::text, 'missing')
union all
select
  'Function exists: public.is_service_role()',
  case when to_regprocedure('public.is_service_role()') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regprocedure('public.is_service_role()')::text, 'missing')
union all
select
  'Function exists: public.is_privileged_db_role()',
  case when to_regprocedure('public.is_privileged_db_role()') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regprocedure('public.is_privileged_db_role()')::text, 'missing')
union all
select
  'Function exists: public.is_local_product_image_path(text)',
  case when to_regprocedure('public.is_local_product_image_path(text)') is not null then 'PASS' else 'FAIL' end,
  coalesce(to_regprocedure('public.is_local_product_image_path(text)')::text, 'missing');

-- 3. Role protection trigger exists.
select
  'Trigger exists: public.profiles role protection' as check_name,
  case when exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and t.tgname = 'prevent_non_admin_role_change_trigger'
      and not t.tgisinternal
  ) then 'PASS' else 'FAIL' end as result,
  'prevent_non_admin_role_change_trigger should block customer role escalation' as detail;

-- 4. Canonical public policies list.
select
  'PUBLIC POLICY' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 5. Product-images bucket configuration.
select
  'Bucket exists: product-images' as check_name,
  case
    when id = 'product-images' and public = true and file_size_limit <= 5242880 then 'PASS'
    when id = 'product-images' then 'FAIL'
    else 'FAIL'
  end as result,
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'product-images';

-- 6. Storage policies for product-images review.
select
  'STORAGE POLICY' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
order by policyname;

-- 7. Required product-images storage policies exist.
with required_policies(policyname) as (
  values
    ('product_images_public_read_storage'),
    ('product_images_admin_insert_storage'),
    ('product_images_admin_update_storage'),
    ('product_images_admin_delete_storage')
)
select
  'Storage policy exists: ' || r.policyname as check_name,
  case when p.policyname is not null then 'PASS' else 'FAIL' end as result,
  coalesce(p.cmd, 'missing') as detail
from required_policies r
left join pg_policies p
  on p.schemaname = 'storage'
 and p.tablename = 'objects'
 and p.policyname = r.policyname
order by r.policyname;

-- 8. Suspicious public write policies on highly sensitive tables.
with sensitive_tables(table_name) as (
  values
    ('profiles'),
    ('products'),
    ('product_images'),
    ('orders'),
    ('order_items'),
    ('payments'),
    ('addresses'),
    ('cart_items'),
    ('wishlists'),
    ('coupons'),
    ('admin_audit_logs'),
    ('admin_rate_limits'),
    ('rate_limits'),
    ('razorpay_webhook_events'),
    ('phone_otp_requests')
),
suspicious as (
  select p.*
  from pg_policies p
  join sensitive_tables s on s.table_name = p.tablename
  where p.schemaname = 'public'
    and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (
      'public' = any(p.roles)
      or 'anon' = any(p.roles)
      or 'authenticated' = any(p.roles)
    )
    and coalesce(p.qual, '') not ilike '%public.is_admin%'
    and coalesce(p.with_check, '') not ilike '%public.is_admin%'
    and coalesce(p.qual, '') not ilike '%auth.uid%'
    and coalesce(p.with_check, '') not ilike '%auth.uid%'
)
select
  'No dangerous public write policy on sensitive public tables' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as suspicious_policy_count
from suspicious;

-- Details if the previous check failed.
with sensitive_tables(table_name) as (
  values
    ('profiles'),
    ('products'),
    ('product_images'),
    ('orders'),
    ('order_items'),
    ('payments'),
    ('addresses'),
    ('cart_items'),
    ('wishlists'),
    ('coupons'),
    ('admin_audit_logs'),
    ('admin_rate_limits'),
    ('rate_limits'),
    ('razorpay_webhook_events'),
    ('phone_otp_requests')
)
select
  'SUSPICIOUS_PUBLIC_WRITE_POLICY' as check_name,
  p.schemaname,
  p.tablename,
  p.policyname,
  p.cmd,
  p.roles,
  p.qual,
  p.with_check
from pg_policies p
join sensitive_tables s on s.table_name = p.tablename
where p.schemaname = 'public'
  and p.cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (
    'public' = any(p.roles)
    or 'anon' = any(p.roles)
    or 'authenticated' = any(p.roles)
  )
  and coalesce(p.qual, '') not ilike '%public.is_admin%'
  and coalesce(p.with_check, '') not ilike '%public.is_admin%'
  and coalesce(p.qual, '') not ilike '%auth.uid%'
  and coalesce(p.with_check, '') not ilike '%auth.uid%'
order by p.tablename, p.policyname;

-- 9. Suspicious public storage write policies for product-images.
with suspicious_storage as (
  select *
  from pg_policies
  where schemaname = 'storage'
    and tablename = 'objects'
    and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    and (
      coalesce(qual, '') ilike '%product-images%'
      or coalesce(with_check, '') ilike '%product-images%'
    )
    and coalesce(qual, '') not ilike '%public.is_admin%'
    and coalesce(with_check, '') not ilike '%public.is_admin%'
)
select
  'No non-admin storage write policy for product-images' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as result,
  count(*) as suspicious_policy_count
from suspicious_storage;

-- Details if the previous storage check failed.
select
  'SUSPICIOUS_STORAGE_WRITE_POLICY' as check_name,
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  qual,
  with_check
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  and (
    coalesce(qual, '') ilike '%product-images%'
    or coalesce(with_check, '') ilike '%product-images%'
  )
  and coalesce(qual, '') not ilike '%public.is_admin%'
  and coalesce(with_check, '') not ilike '%public.is_admin%'
order by policyname;

-- 10. Admin users still present.
select
  'Admin profile exists' as check_name,
  case when count(*) > 0 then 'PASS' else 'FAIL' end as result,
  count(*) as admin_profile_count
from public.profiles
where role = 'admin'
  and coalesce(is_active, true) = true;

-- 11. Product image local path detection.
-- If your products.images column is text[], run:
-- select id, slug, title, images
-- from public.products
-- where exists (
--   select 1
--   from unnest(coalesce(images, array[]::text[])) as image_value
--   where public.is_local_product_image_path(image_value)
-- );

-- If your products.images column is jsonb, run:
-- select id, slug, title, images
-- from public.products
-- where jsonb_typeof(images) = 'array'
--   and exists (
--     select 1
--     from jsonb_array_elements_text(images) as image_value
--     where public.is_local_product_image_path(image_value)
--   );

-- If your products.image_url column exists, run:
-- select id, slug, title, image_url
-- from public.products
-- where public.is_local_product_image_path(image_url);
