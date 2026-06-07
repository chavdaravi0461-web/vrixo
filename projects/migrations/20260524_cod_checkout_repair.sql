-- VRIXO COD checkout repair
-- Run this once in Supabase SQL editor or through your migration pipeline.

create extension if not exists pgcrypto;

alter table if exists public.orders
  add column if not exists payment_method text not null default 'cod',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists order_status text not null default 'pending',
  add column if not exists phone text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists shipping_address jsonb not null default '{}'::jsonb,
  add column if not exists customer_name text not null default '',
  add column if not exists customer_phone text not null default '',
  add column if not exists customer_email text not null default '',
  add column if not exists subtotal numeric(10,2) not null default 0,
  add column if not exists discount numeric(10,2) not null default 0,
  add column if not exists shipping_charge numeric(10,2) not null default 0,
  add column if not exists total numeric(10,2) not null default 0,
  add column if not exists total_amount numeric(10,2) not null default 0,
  add column if not exists coupon_code text,
  add column if not exists whatsapp_status text default 'pending',
  add column if not exists whatsapp_error text,
  add column if not exists idempotency_key text,
  add column if not exists notes jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.orders
set
  payment_method = case
    when lower(coalesce(payment_method, '')) in ('online', 'online payment') then 'online'
    else 'cod'
  end,
  payment_status = case
    when lower(coalesce(payment_status, '')) = 'paid' then 'paid'
    when lower(coalesce(payment_status, '')) = 'failed' then 'failed'
    when lower(coalesce(payment_status, '')) = 'refunded' then 'refunded'
    when lower(coalesce(payment_method, '')) = 'cod' then 'cod_pending'
    else coalesce(nullif(payment_status, ''), 'pending')
  end,
  order_status = coalesce(nullif(lower(order_status), ''), 'pending'),
  customer_phone = coalesce(nullif(customer_phone, ''), nullif(phone, ''), shipping_address ->> 'phone', ''),
  phone = coalesce(nullif(phone, ''), nullif(customer_phone, ''), shipping_address ->> 'phone', ''),
  items = coalesce(items, '[]'::jsonb),
  shipping_address = coalesce(shipping_address, '{}'::jsonb),
  total_amount = coalesce(nullif(total_amount, 0), total, 0),
  updated_at = timezone('utc', now());

alter table if exists public.orders drop constraint if exists orders_payment_method_check;
alter table if exists public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'online'));

alter table if exists public.orders drop constraint if exists orders_payment_status_check;
alter table if exists public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'cod_pending', 'paid', 'failed', 'refunded'));

alter table if exists public.orders drop constraint if exists orders_order_status_check;
alter table if exists public.orders add constraint orders_order_status_check
  check (order_status in ('pending', 'confirmed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'));

create unique index if not exists idx_orders_idempotency_key_unique
  on public.orders(idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_orders_user_created_at on public.orders(user_id, created_at desc);
create index if not exists idx_orders_customer_phone on public.orders(customer_phone);
create index if not exists idx_orders_payment_status on public.orders(payment_method, payment_status);
create index if not exists idx_orders_whatsapp_status on public.orders(whatsapp_status);

create or replace function public.sync_order_phone()
returns trigger
language plpgsql
as $$
begin
  new.customer_phone := coalesce(nullif(new.customer_phone, ''), nullif(new.phone, ''), new.shipping_address ->> 'phone', '');
  new.phone := coalesce(nullif(new.phone, ''), nullif(new.customer_phone, ''), new.shipping_address ->> 'phone', '');
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sync_order_phone_trigger on public.orders;
create trigger sync_order_phone_trigger
before insert or update on public.orders
for each row
execute function public.sync_order_phone();

alter table if exists public.orders enable row level security;
alter table if exists public.addresses enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.payments enable row level security;

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
  for select
  using (auth.uid() = user_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own" on public.orders
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "orders_update_own_safe" on public.orders;
create policy "orders_update_own_safe" on public.orders
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "addresses_select_own" on public.addresses;
create policy "addresses_select_own" on public.addresses
  for select
  using (auth.uid() = user_id);

drop policy if exists "addresses_insert_own" on public.addresses;
create policy "addresses_insert_own" on public.addresses
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "order_items_select_own_order" on public.order_items;
create policy "order_items_select_own_order" on public.order_items
  for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

drop policy if exists "payments_select_own_order" on public.payments;
create policy "payments_select_own_order" on public.payments
  for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = payments.order_id
      and orders.user_id = auth.uid()
    )
  );

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update on public.orders to authenticated;
grant select, insert, update on public.addresses to authenticated;
grant select on public.order_items to authenticated;
grant select on public.payments to authenticated;
