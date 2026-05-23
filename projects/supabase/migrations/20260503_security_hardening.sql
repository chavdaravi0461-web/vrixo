create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(is_active, true) = true
  );
$$;

alter table if exists public.profiles enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.coupons enable row level security;
alter table if exists public.contact_messages enable row level security;
alter table if exists public.admin_activity_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage" on public.profiles
for all using (public.is_admin())
with check (public.is_admin());

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins can change profile roles.';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_non_admin_role_change_trigger on public.profiles;
create trigger prevent_non_admin_role_change_trigger
before update on public.profiles
for each row execute function public.prevent_non_admin_role_change();

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
for select using (status = 'active' or public.is_admin());

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
for insert with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
for delete using (public.is_admin());

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
for update using (public.is_admin())
with check (public.is_admin());

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

drop policy if exists "order_items_admin_manage" on public.order_items;
create policy "order_items_admin_manage" on public.order_items
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
for select using (
  public.is_admin()
  or exists (
    select 1
    from public.orders
    where orders.id = payments.order_id
      and orders.user_id = auth.uid()
  )
);

drop policy if exists "payments_admin_manage" on public.payments;
create policy "payments_admin_manage" on public.payments
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "coupons_read_available_or_own" on public.coupons;
create policy "coupons_read_available_or_own" on public.coupons
for select using (
  public.is_admin()
  or (
    source <> 'game'
    and user_id is null
    and active = true
    and coalesce(used, false) = false
    and (starts_at is null or starts_at <= timezone('utc', now()))
    and (coalesce(expires_at, ends_at) is null or coalesce(expires_at, ends_at) >= timezone('utc', now()))
  )
  or auth.uid() = user_id
);

drop policy if exists "coupons_admin_manage" on public.coupons;
create policy "coupons_admin_manage" on public.coupons
for all using (public.is_admin())
with check (public.is_admin());

drop policy if exists "contact_messages_public_insert" on public.contact_messages;
create policy "contact_messages_public_insert" on public.contact_messages
for insert with check (true);

drop policy if exists "contact_messages_admin_manage" on public.contact_messages;
create policy "contact_messages_admin_manage" on public.contact_messages
for all using (public.is_admin())
with check (public.is_admin());

do $$
begin
  if to_regclass('public.admin_activity_logs') is not null then
    execute 'drop policy if exists "admin_activity_logs_admin_read" on public.admin_activity_logs';
    execute 'create policy "admin_activity_logs_admin_read" on public.admin_activity_logs for select using (public.is_admin())';
    execute 'drop policy if exists "admin_activity_logs_admin_insert" on public.admin_activity_logs';
    execute 'create policy "admin_activity_logs_admin_insert" on public.admin_activity_logs for insert with check (public.is_admin())';
  end if;
end $$;
