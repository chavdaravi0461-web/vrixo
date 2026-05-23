-- DreamCart private admin hardening.
-- Safe to rerun. This binds database-level admin checks to the single owner email.

create extension if not exists pgcrypto;

alter table if exists public.profiles enable row level security;
alter table if exists public.products enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.payments enable row level security;

alter table if exists public.profiles
  add column if not exists role text not null default 'customer',
  add column if not exists is_active boolean not null default true;

alter table if exists public.profiles drop constraint if exists profiles_role_check;
alter table if exists public.profiles
  add constraint profiles_role_check check (role in ('customer', 'admin'));

update public.profiles
set role = 'admin',
    is_active = true
where lower(email) = 'chavdaravi0461@gmail.com';

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'admin'
      and coalesce(is_active, true) = true
      and lower(coalesce(email, '')) = 'chavdaravi0461@gmail.com'
  );
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

grant execute on function public.is_admin(uuid) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.prevent_non_admin_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role
    and not public.is_admin(auth.uid())
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'Only the DreamCart admin can change profile roles.';
  end if;

  if lower(coalesce(old.email, '')) <> 'chavdaravi0461@gmail.com'
    and new.role = 'admin'
    and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
  then
    raise exception 'Only the configured DreamCart owner email can be admin.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_non_admin_role_change_trigger on public.profiles;
create trigger prevent_non_admin_role_change_trigger
before update on public.profiles
for each row execute function public.prevent_non_admin_role_change();

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin(auth.uid()));

drop policy if exists "profiles_insert_own_customer" on public.profiles;
create policy "profiles_insert_own_customer" on public.profiles
for insert with check (auth.uid() = id and role = 'customer');

drop policy if exists "profiles_update_own_safe" on public.profiles;
create policy "profiles_update_own_safe" on public.profiles
for update using (auth.uid() = id)
with check (auth.uid() = id and role = 'customer');

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage" on public.profiles
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
for insert with check (public.is_admin(auth.uid()));

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
for update using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
for delete using (public.is_admin(auth.uid()));

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin" on public.orders
for select using (auth.uid() = user_id or public.is_admin(auth.uid()));

drop policy if exists "orders_admin_manage" on public.orders;
create policy "orders_admin_manage" on public.orders
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "order_items_select_own_or_admin" on public.order_items;
create policy "order_items_select_own_or_admin" on public.order_items
for select using (
  public.is_admin(auth.uid())
  or exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

drop policy if exists "order_items_admin_manage" on public.order_items;
create policy "order_items_admin_manage" on public.order_items
for all using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));
