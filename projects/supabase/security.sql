/*
DreamCart Production Security SQL

Admin access code alone = weak.
Supabase Auth + admin role + RLS + server-side verification = strong.

This script is designed to be safe and rerunnable.
It must not drop tables, delete users, delete products, delete orders, or wipe data.
It does not automatically clean product images.
It does not modify Razorpay routes.
It must be reviewed before running in Supabase SQL Editor.

Live issue addressed:
Product images must never store or render local PC paths like:
C:\Users\PC\...
file://...
OneDrive/Pictures/Screenshots paths

Run schema/detection queries first before running optional cleanup.
*/

create extension if not exists pgcrypto;

-- 1. Safe schema helpers.
create or replace function public.table_exists(table_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select to_regclass(format('public.%I', $1)) is not null;
$$;

create or replace function public.column_exists(table_name text, column_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = $1
      and c.column_name = $2
  );
$$;

create or replace function public.is_service_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
$$;

create or replace function public.is_privileged_db_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user in ('postgres', 'supabase_admin', 'service_role')
    or session_user in ('postgres', 'supabase_admin', 'service_role');
$$;

create or replace function public.is_admin(user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  admin_exists boolean := false;
begin
  if user_id is null then
    return false;
  end if;

  if not public.table_exists('profiles')
    or not public.column_exists('profiles', 'id')
    or not public.column_exists('profiles', 'role')
  then
    return false;
  end if;

  if public.column_exists('profiles', 'is_active') then
    execute
      'select exists (
        select 1
        from public.profiles
        where id = $1
          and role = ''admin''
          and coalesce(is_active, true) = true
      )'
      into admin_exists
      using user_id;
  else
    execute
      'select exists (
        select 1
        from public.profiles
        where id = $1
          and role = ''admin''
      )'
      into admin_exists
      using user_id;
  end if;

  return coalesce(admin_exists, false);
end;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(auth.uid());
$$;

create or replace function public.is_local_product_image_path(value text)
returns boolean
language sql
immutable
as $$
  select case
    when value is null or btrim(value) = '' then false
    else
      position(chr(92) in value) > 0
      or lower(btrim(value)) like 'file://%'
      or lower(btrim(value)) like '_:/%'
      or lower(btrim(value)) like '%onedrive%'
      or lower(btrim(value)) like '%pictures%'
      or lower(btrim(value)) like '%screenshots%'
      or lower(btrim(value)) like '/users/%'
      or lower(btrim(value)) like '/home/%'
  end;
$$;

create or replace function public.is_safe_product_image_value(value text)
returns boolean
language sql
immutable
as $$
  select case
    when value is null or btrim(value) = '' then false
    when public.is_local_product_image_path(value) then false
    when position('..' in value) > 0 then false
    when lower(btrim(value)) like 'https://%' then true
    when lower(btrim(value)) like 'http://%' then true
    when btrim(value) like '/%' and btrim(value) not like '//%' then true
    else false
  end;
$$;

grant execute on function public.table_exists(text) to anon, authenticated;
grant execute on function public.column_exists(text, text) to anon, authenticated;
grant execute on function public.is_service_role() to anon, authenticated;
grant execute on function public.is_privileged_db_role() to anon, authenticated;
grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_local_product_image_path(text) to anon, authenticated;
grant execute on function public.is_safe_product_image_value(text) to anon, authenticated;

-- 2. Role model hardening. Existing admins remain admin. Old role "user" becomes "customer".
do $$
begin
  if public.table_exists('profiles') then
    alter table public.profiles
      add column if not exists role text not null default 'customer',
      add column if not exists is_active boolean not null default true,
      add column if not exists updated_at timestamptz not null default timezone('utc', now());

    alter table public.profiles drop constraint if exists profiles_role_check;

    update public.profiles
    set role = 'customer'
    where role = 'user';

    alter table public.profiles add constraint profiles_role_check
      check (role in ('customer', 'admin'));
  else
    raise notice 'Skipped profile role hardening because public.profiles does not exist.';
  end if;
end $$;

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and not public.is_admin(auth.uid())
    and not public.is_service_role()
    and not public.is_privileged_db_role()
  then
    raise exception 'Only admins can change profile roles.';
  end if;

  if public.column_exists('profiles', 'updated_at') then
    new.updated_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

do $$
begin
  if public.table_exists('profiles')
    and public.column_exists('profiles', 'role')
  then
    drop trigger if exists prevent_non_admin_role_change_trigger on public.profiles;
    create trigger prevent_non_admin_role_change_trigger
    before update on public.profiles
    for each row execute function public.prevent_non_admin_role_change();
  else
    raise notice 'Skipped role protection trigger because public.profiles.role is missing.';
  end if;
end $$;

-- 3. Product image leak review helpers. These comments do not modify product data.
-- Schema check:
-- select column_name, data_type, udt_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'products'
--   and column_name in ('images', 'image_url', 'status', 'is_active');

-- Detection for images text[]:
-- select id, slug, title, images
-- from public.products
-- where exists (
--   select 1
--   from unnest(coalesce(images, array[]::text[])) as image_value
--   where public.is_local_product_image_path(image_value)
-- );

-- Detection for images jsonb:
-- select id, slug, title, images
-- from public.products
-- where jsonb_typeof(images) = 'array'
--   and exists (
--     select 1
--     from jsonb_array_elements_text(images) as image_value
--     where public.is_local_product_image_path(image_value)
--   );

-- Detection for image_url text:
-- select id, slug, title, image_url
-- from public.products
-- where public.is_local_product_image_path(image_url);

-- Optional cleanup examples. Review detection results first. Do not run blindly.
-- text[] cleanup:
-- update public.products
-- set images = coalesce((
--   select array_agg(image_value)
--   from unnest(coalesce(images, array[]::text[])) as image_value
--   where public.is_safe_product_image_value(image_value)
-- ), array[]::text[])
-- where exists (
--   select 1
--   from unnest(coalesce(images, array[]::text[])) as image_value
--   where public.is_local_product_image_path(image_value)
--      or not public.is_safe_product_image_value(image_value)
-- );

-- image_url cleanup example:
-- update public.products
-- set image_url = null
-- where public.is_local_product_image_path(image_url)
--    or not public.is_safe_product_image_value(image_url);

-- 4. Operational security tables.
-- These tables are intentionally not writable by browser clients.
-- Server-side code must use SUPABASE_SERVICE_ROLE_KEY through a server-only admin client.
-- Never expose the service role key to frontend code.
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid,
  admin_email text,
  action text not null,
  target_table text,
  target_id text,
  ip text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_rate_limits (
  key text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rate_limits (
  key text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null,
  blocked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.razorpay_webhook_events (
  event_id text primary key,
  event_name text,
  provider_order_id text,
  provider_payment_id text,
  processed_at timestamptz not null default timezone('utc', now()),
  payload jsonb not null default '{}'::jsonb
);

comment on table public.admin_audit_logs is 'Server-only operational table. Browser clients must not write. Use service role only on the server.';
comment on table public.admin_rate_limits is 'Server-only operational table. Browser clients must not write. Use service role only on the server.';
comment on table public.rate_limits is 'Server-only operational table. Browser clients must not write. Use service role only on the server.';
comment on table public.razorpay_webhook_events is 'Server-only idempotency/log table. Browser clients must not write. Use service role only on the server.';

-- 5. Drop all existing public policies from canonical tables, then recreate final policies.
-- This prevents older weak policy names from remaining active.
do $$
declare
  target_table text;
  policy_record record;
  target_tables text[] := array[
    'profiles',
    'products',
    'categories',
    'product_images',
    'addresses',
    'cart_items',
    'wishlists',
    'product_reviews',
    'coupons',
    'orders',
    'order_items',
    'payments',
    'newsletter_subscriptions',
    'newsletter_subscribers',
    'contact_messages',
    'contacts',
    'game_sessions',
    'daily_game_rewards',
    'phone_otp_requests',
    'admin_audit_logs',
    'admin_rate_limits',
    'rate_limits',
    'razorpay_webhook_events'
  ];
begin
  foreach target_table in array target_tables loop
    if public.table_exists(target_table) then
      execute format('alter table public.%I enable row level security', target_table);

      for policy_record in
        select policyname
        from pg_policies
        where schemaname = 'public'
          and tablename = target_table
      loop
        execute format('drop policy if exists %I on public.%I', policy_record.policyname, target_table);
      end loop;
    else
      raise notice 'Skipped policy reset for missing table public.%', target_table;
    end if;
  end loop;
end $$;

-- 6. Profiles policies.
do $$
begin
  if public.table_exists('profiles')
    and public.column_exists('profiles', 'id')
    and public.column_exists('profiles', 'role')
  then
    execute 'create policy "profiles_select_own_or_admin" on public.profiles
      for select using (auth.uid() = id or public.is_admin(auth.uid()))';

    execute 'create policy "profiles_insert_own_customer" on public.profiles
      for insert with check (auth.uid() = id and role = ''customer'')';

    execute 'create policy "profiles_update_own_safe" on public.profiles
      for update using (auth.uid() = id)
      with check (auth.uid() = id and role = ''customer'')';

    execute 'create policy "profiles_admin_manage" on public.profiles
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped profiles policies because public.profiles id/role columns are missing.';
  end if;
end $$;

-- 7. Products, categories, and product_images policies.
do $$
declare
  product_public_condition text;
  product_image_condition text;
begin
  if public.table_exists('products') and public.column_exists('products', 'id') then
    if public.column_exists('products', 'status') and public.column_exists('products', 'is_active') then
      product_public_condition := '(coalesce(lower(status), ''active'') = ''active'' or coalesce(is_active, false) = true or public.is_admin(auth.uid()))';
      product_image_condition := '(coalesce(lower(products.status), ''active'') = ''active'' or coalesce(products.is_active, false) = true)';
    elsif public.column_exists('products', 'status') then
      product_public_condition := '(coalesce(lower(status), ''active'') = ''active'' or public.is_admin(auth.uid()))';
      product_image_condition := '(coalesce(lower(products.status), ''active'') = ''active'')';
    elsif public.column_exists('products', 'is_active') then
      product_public_condition := '(coalesce(is_active, false) = true or public.is_admin(auth.uid()))';
      product_image_condition := '(coalesce(products.is_active, false) = true)';
    else
      raise notice 'public.products has no status/is_active column. Public product read is allowed to avoid breaking shop listing; product writes remain admin-only.';
      product_public_condition := 'true';
      product_image_condition := 'true';
    end if;

    execute format('create policy "products_public_read_active" on public.products for select using (%s)', product_public_condition);
    execute 'create policy "products_admin_insert" on public.products for insert with check (public.is_admin(auth.uid()))';
    execute 'create policy "products_admin_update" on public.products for update using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()))';
    execute 'create policy "products_admin_delete" on public.products for delete using (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped products policies because public.products or public.products.id is missing.';
  end if;

  if public.table_exists('categories') then
    if public.column_exists('categories', 'is_active') then
      execute 'create policy "categories_public_read_active" on public.categories
        for select using (coalesce(is_active, true) = true or public.is_admin(auth.uid()))';
    else
      raise notice 'public.categories has no is_active column. Public category read is allowed to avoid breaking category navigation.';
      execute 'create policy "categories_public_read" on public.categories
        for select using (true)';
    end if;

    execute 'create policy "categories_admin_manage" on public.categories
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped categories policies because public.categories does not exist.';
  end if;

  if public.table_exists('product_images')
    and public.column_exists('product_images', 'product_id')
    and public.table_exists('products')
    and public.column_exists('products', 'id')
  then
    if product_image_condition is null then
      product_image_condition := 'true';
    end if;

    execute format('create policy "product_images_public_read_for_active_products" on public.product_images
      for select using (
        public.is_admin(auth.uid())
        or exists (
          select 1
          from public.products
          where products.id = product_images.product_id
            and %s
        )
      )', product_image_condition);

    execute 'create policy "product_images_admin_manage" on public.product_images
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped product_images policies because table/columns are missing.';
  end if;
end $$;

-- 8. Customer-owned data policies.
do $$
begin
  if public.table_exists('addresses') and public.column_exists('addresses', 'user_id') then
    execute 'create policy "addresses_select_own_or_admin" on public.addresses
      for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
    execute 'create policy "addresses_insert_own" on public.addresses
      for insert with check (auth.uid() = user_id)';
    execute 'create policy "addresses_update_own" on public.addresses
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id)';
    execute 'create policy "addresses_delete_own" on public.addresses
      for delete using (auth.uid() = user_id)';
    execute 'create policy "addresses_admin_manage" on public.addresses
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped addresses policies because public.addresses.user_id is missing.';
  end if;

  if public.table_exists('cart_items') and public.column_exists('cart_items', 'user_id') then
    execute 'create policy "cart_items_select_own_or_admin" on public.cart_items
      for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
    execute 'create policy "cart_items_insert_own" on public.cart_items
      for insert with check (auth.uid() = user_id)';
    execute 'create policy "cart_items_update_own" on public.cart_items
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id)';
    execute 'create policy "cart_items_delete_own" on public.cart_items
      for delete using (auth.uid() = user_id)';
    execute 'create policy "cart_items_admin_manage" on public.cart_items
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped cart_items policies because public.cart_items.user_id is missing.';
  end if;

  if public.table_exists('wishlists') and public.column_exists('wishlists', 'user_id') then
    execute 'create policy "wishlists_select_own_or_admin" on public.wishlists
      for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
    execute 'create policy "wishlists_insert_own" on public.wishlists
      for insert with check (auth.uid() = user_id)';
    execute 'create policy "wishlists_delete_own" on public.wishlists
      for delete using (auth.uid() = user_id)';
    execute 'create policy "wishlists_admin_manage" on public.wishlists
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped wishlists policies because public.wishlists.user_id is missing.';
  end if;
end $$;

-- 9. Orders, order_items, and payments policies.
do $$
begin
  if public.table_exists('orders')
    and public.column_exists('orders', 'id')
    and public.column_exists('orders', 'user_id')
  then
    execute 'create policy "orders_select_own_or_admin" on public.orders
      for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
    execute 'create policy "orders_insert_own" on public.orders
      for insert with check (auth.uid() = user_id)';
    execute 'create policy "orders_admin_manage" on public.orders
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped orders policies because public.orders id/user_id columns are missing.';
  end if;

  if public.table_exists('order_items')
    and public.column_exists('order_items', 'order_id')
    and public.table_exists('orders')
    and public.column_exists('orders', 'id')
    and public.column_exists('orders', 'user_id')
  then
    execute 'create policy "order_items_select_own_or_admin" on public.order_items
      for select using (
        public.is_admin(auth.uid())
        or exists (
          select 1
          from public.orders
          where orders.id = order_items.order_id
            and orders.user_id = auth.uid()
        )
      )';
    execute 'create policy "order_items_insert_own_order" on public.order_items
      for insert with check (
        exists (
          select 1
          from public.orders
          where orders.id = order_items.order_id
            and orders.user_id = auth.uid()
        )
      )';
    execute 'create policy "order_items_admin_manage" on public.order_items
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped order_items policies because required order relation columns are missing.';
  end if;

  if public.table_exists('payments')
    and public.column_exists('payments', 'order_id')
    and public.table_exists('orders')
    and public.column_exists('orders', 'id')
    and public.column_exists('orders', 'user_id')
  then
    execute 'create policy "payments_select_own_or_admin" on public.payments
      for select using (
        public.is_admin(auth.uid())
        or exists (
          select 1
          from public.orders
          where orders.id = payments.order_id
            and orders.user_id = auth.uid()
        )
      )';
    execute 'create policy "payments_admin_manage" on public.payments
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped payments policies because required payment/order relation columns are missing.';
  end if;
end $$;

-- 10. Reviews, coupons, contact, and newsletter policies.
do $$
begin
  if public.table_exists('product_reviews') then
    if public.column_exists('product_reviews', 'status') then
      execute 'create policy "reviews_public_read_approved" on public.product_reviews
        for select using (coalesce(status, ''approved'') = ''approved'' or public.is_admin(auth.uid()))';
    else
      raise notice 'public.product_reviews.status missing. Public review read policy skipped.';
    end if;

    if public.column_exists('product_reviews', 'user_id') then
      execute 'create policy "reviews_insert_own" on public.product_reviews
        for insert with check (auth.uid() = user_id)';
      execute 'create policy "reviews_update_own" on public.product_reviews
        for update using (auth.uid() = user_id)
        with check (auth.uid() = user_id)';
    else
      raise notice 'public.product_reviews.user_id missing. Own-review insert/update policies skipped.';
    end if;

    execute 'create policy "reviews_admin_manage" on public.product_reviews
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped product_reviews policies because public.product_reviews does not exist.';
  end if;

  if public.table_exists('coupons') then
    if public.column_exists('coupons', 'source')
      and public.column_exists('coupons', 'user_id')
      and public.column_exists('coupons', 'active')
      and public.column_exists('coupons', 'used')
    then
      execute 'create policy "coupons_read_available_or_own" on public.coupons
        for select using (
          public.is_admin(auth.uid())
          or (
            source <> ''game''
            and user_id is null
            and active = true
            and coalesce(used, false) = false
          )
          or auth.uid() = user_id
        )';
    elsif public.column_exists('coupons', 'user_id') then
      execute 'create policy "coupons_read_own_or_admin" on public.coupons
        for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
      raise notice 'Created conservative coupon read policy because availability columns are missing.';
    else
      raise notice 'Skipped public coupon read policy because required columns are missing.';
    end if;

    execute 'create policy "coupons_admin_manage" on public.coupons
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped coupons policies because public.coupons does not exist.';
  end if;

  if public.table_exists('contact_messages') then
    execute 'create policy "contact_messages_public_insert" on public.contact_messages
      for insert with check (true)';
    execute 'create policy "contact_messages_admin_manage" on public.contact_messages
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped contact_messages policies because public.contact_messages does not exist.';
  end if;

  if public.table_exists('contacts') then
    execute 'create policy "contacts_public_insert" on public.contacts
      for insert with check (true)';
    execute 'create policy "contacts_admin_manage" on public.contacts
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped contacts policies because public.contacts does not exist.';
  end if;

  if public.table_exists('newsletter_subscriptions') then
    execute 'create policy "newsletter_public_insert" on public.newsletter_subscriptions
      for insert with check (true)';
    execute 'create policy "newsletter_admin_manage" on public.newsletter_subscriptions
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped newsletter_subscriptions policies because public.newsletter_subscriptions does not exist.';
  end if;

  if public.table_exists('newsletter_subscribers') then
    execute 'create policy "newsletter_subscribers_public_insert" on public.newsletter_subscribers
      for insert with check (true)';
    execute 'create policy "newsletter_subscribers_admin_manage" on public.newsletter_subscribers
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped newsletter_subscribers policies because public.newsletter_subscribers does not exist.';
  end if;
end $$;

-- 11. Game/OTP and operational table policies.
do $$
begin
  if public.table_exists('game_sessions') and public.column_exists('game_sessions', 'user_id') then
    execute 'create policy "game_sessions_select_own_or_admin" on public.game_sessions
      for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
    execute 'create policy "game_sessions_insert_own" on public.game_sessions
      for insert with check (auth.uid() = user_id)';
    execute 'create policy "game_sessions_update_own" on public.game_sessions
      for update using (auth.uid() = user_id)
      with check (auth.uid() = user_id)';
    execute 'create policy "game_sessions_admin_manage" on public.game_sessions
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped game_sessions policies because public.game_sessions.user_id is missing.';
  end if;

  if public.table_exists('daily_game_rewards') and public.column_exists('daily_game_rewards', 'user_id') then
    execute 'create policy "daily_game_rewards_select_own_or_admin" on public.daily_game_rewards
      for select using (auth.uid() = user_id or public.is_admin(auth.uid()))';
    execute 'create policy "daily_game_rewards_admin_manage" on public.daily_game_rewards
      for all using (public.is_admin(auth.uid()))
      with check (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped daily_game_rewards policies because public.daily_game_rewards.user_id is missing.';
  end if;

  if public.table_exists('phone_otp_requests') then
    alter table public.phone_otp_requests enable row level security;
    execute 'create policy "phone_otp_requests_admin_read" on public.phone_otp_requests
      for select using (public.is_admin(auth.uid()))';
  else
    raise notice 'Skipped phone_otp_requests policies because public.phone_otp_requests does not exist.';
  end if;
end $$;

-- 12. Operational table policies: admin read only; no browser write policies.
do $$
begin
  if public.table_exists('admin_audit_logs') then
    alter table public.admin_audit_logs enable row level security;
    execute 'create policy "admin_audit_logs_admin_read" on public.admin_audit_logs
      for select using (public.is_admin(auth.uid()))';
  end if;

  if public.table_exists('admin_rate_limits') then
    alter table public.admin_rate_limits enable row level security;
    execute 'create policy "admin_rate_limits_admin_read" on public.admin_rate_limits
      for select using (public.is_admin(auth.uid()))';
  end if;

  if public.table_exists('rate_limits') then
    alter table public.rate_limits enable row level security;
    execute 'create policy "rate_limits_admin_read" on public.rate_limits
      for select using (public.is_admin(auth.uid()))';
  end if;

  if public.table_exists('razorpay_webhook_events') then
    alter table public.razorpay_webhook_events enable row level security;
    execute 'create policy "razorpay_webhook_events_admin_read" on public.razorpay_webhook_events
      for select using (public.is_admin(auth.uid()))';
  end if;
end $$;

-- 13. Supabase Storage bucket and product image policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "product_images_public_read_storage" on storage.objects;
drop policy if exists "product_images_admin_insert_storage" on storage.objects;
drop policy if exists "product_images_admin_update_storage" on storage.objects;
drop policy if exists "product_images_admin_delete_storage" on storage.objects;

create policy "product_images_public_read_storage" on storage.objects
for select using (bucket_id = 'product-images');

create policy "product_images_admin_insert_storage" on storage.objects
for insert with check (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
  and (
    metadata is null
    or metadata ->> 'mimetype' is null
    or lower(metadata ->> 'mimetype') in ('image/jpeg', 'image/png', 'image/webp')
  )
);

create policy "product_images_admin_update_storage" on storage.objects
for update using (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
);

create policy "product_images_admin_delete_storage" on storage.objects
for delete using (
  bucket_id = 'product-images'
  and public.is_admin(auth.uid())
);

-- Manual storage policy review. Do not automatically drop other storage policies because other buckets may depend on them.
-- select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects';

-- Before trusting storage security, manually review storage.objects policies and remove any policy that allows
-- INSERT, UPDATE, or DELETE on bucket_id = 'product-images' for anon/authenticated users without public.is_admin(auth.uid()).
-- Final intended storage:
-- public read only
-- admin insert only
-- admin update only
-- admin delete only
-- no anonymous/customer upload

-- 14. Final verification queries. Run these after reviewing and applying the script.
-- Check public policies:
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, policyname;

-- Check storage policies:
-- select schemaname, tablename, policyname, cmd, qual, with_check
-- from pg_policies
-- where schemaname = 'storage'
--   and tablename = 'objects';

-- Check products schema:
-- select column_name, data_type, udt_name
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'products'
--   and column_name in ('images', 'image_url', 'status', 'is_active');

-- Check bad product image paths for images text[]:
-- select id, slug, title, images
-- from public.products
-- where exists (
--   select 1
--   from unnest(coalesce(images, array[]::text[])) as image_value
--   where public.is_local_product_image_path(image_value)
-- );

-- Check bad product image paths for images jsonb:
-- select id, slug, title, images
-- from public.products
-- where jsonb_typeof(images) = 'array'
--   and exists (
--     select 1
--     from jsonb_array_elements_text(images) as image_value
--     where public.is_local_product_image_path(image_value)
--   );

-- Check bad product image paths for image_url text:
-- select id, slug, title, image_url
-- from public.products
-- where public.is_local_product_image_path(image_url);

-- Check admin users:
-- select id, email, role, is_active
-- from public.profiles
-- where role = 'admin';

-- Check product bucket:
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'product-images';

-- Manual production run order:
-- 1. Run the preflight schema and product image detection queries above first.
-- 2. Backup/export Supabase data before applying production RLS changes.
-- 3. Run this full security.sql in Supabase SQL Editor after review.
-- 4. Run the verification queries above.
-- 5. Review storage.objects policies manually and remove any broad write policy for product-images.
-- 6. Only then deploy/test the application against the secured database.
