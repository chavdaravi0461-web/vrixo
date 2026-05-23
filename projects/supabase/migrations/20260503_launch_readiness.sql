create extension if not exists pgcrypto;

alter table public.orders
  add column if not exists original_amount numeric(10,2) not null default 0,
  add column if not exists discount_amount numeric(10,2) not null default 0,
  add column if not exists final_amount numeric(10,2) not null default 0,
  add column if not exists razorpay_signature_verified boolean not null default false;

update public.orders
set
  original_amount = case when original_amount = 0 then subtotal else original_amount end,
  discount_amount = case when discount_amount = 0 then discount else discount_amount end,
  final_amount = case when final_amount = 0 then total else final_amount end,
  razorpay_signature_verified = case
    when payment_method = 'online' and payment_status = 'paid' and razorpay_signature is not null then true
    else razorpay_signature_verified
  end;

create or replace function public.sync_order_launch_amounts()
returns trigger
language plpgsql
as $$
begin
  new.original_amount := coalesce(nullif(new.original_amount, 0), new.subtotal, 0);
  new.discount_amount := coalesce(new.discount, 0);
  new.final_amount := coalesce(new.total, new.total_amount, 0);
  new.razorpay_signature_verified := (
    new.payment_method = 'online'
    and new.payment_status = 'paid'
    and new.razorpay_signature is not null
  );
  return new;
end;
$$;

drop trigger if exists sync_order_launch_amounts_trigger on public.orders;
create trigger sync_order_launch_amounts_trigger
before insert or update on public.orders
for each row execute function public.sync_order_launch_amounts();

alter table public.coupons
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists session_id text,
  add column if not exists min_order_value numeric(10,2),
  add column if not exists max_discount numeric(10,2),
  add column if not exists used boolean not null default false,
  add column if not exists used_at timestamptz,
  add column if not exists used_order_id uuid references public.orders(id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists source text not null default 'admin';

alter table public.coupons drop constraint if exists coupons_discount_type_check;
alter table public.coupons add constraint coupons_discount_type_check
  check (discount_type in ('percentage', 'fixed', 'free_delivery'));

update public.coupons
set
  min_order_value = coalesce(min_order_value, min_order_amount),
  expires_at = coalesce(expires_at, ends_at),
  source = coalesce(nullif(source, ''), 'admin');

create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  mode text not null default 'coupon' check (mode in ('quick', 'coupon', 'daily')),
  score integer not null default 0,
  duration_seconds integer not null default 0,
  collected_items integer not null default 0,
  obstacles_hit integer not null default 0,
  reward_tier text not null default 'none',
  coupon_id uuid references public.coupons(id) on delete set null,
  is_valid boolean not null default false,
  invalid_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_game_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null,
  coupon_id uuid references public.coupons(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, reward_date)
);

alter table public.game_sessions enable row level security;
alter table public.daily_game_rewards enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "coupons_public_read" on public.coupons;
drop policy if exists "coupons_read_available_or_own" on public.coupons;
create policy "coupons_read_available_or_own" on public.coupons
for select using (
  (
    source <> 'game'
    and user_id is null
    and active = true
    and used = false
    and (starts_at is null or starts_at <= timezone('utc', now()))
    and (coalesce(expires_at, ends_at) is null or coalesce(expires_at, ends_at) >= timezone('utc', now()))
  )
  or auth.uid() = user_id
);

drop policy if exists "game_sessions_select_own" on public.game_sessions;
create policy "game_sessions_select_own" on public.game_sessions
for select using (auth.uid() = user_id);

drop policy if exists "daily_rewards_select_own" on public.daily_game_rewards;
create policy "daily_rewards_select_own" on public.daily_game_rewards
for select using (auth.uid() = user_id);

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders
for select using (auth.uid() = user_id);

drop policy if exists "order_items_select_own" on public.order_items;
create policy "order_items_select_own" on public.order_items
for select using (
  exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
  )
);

create index if not exists idx_orders_user_created_at on public.orders(user_id, created_at desc);
create index if not exists idx_orders_payment_status on public.orders(payment_status);
create index if not exists idx_orders_order_status on public.orders(order_status);
create index if not exists idx_coupons_code on public.coupons(code);
create index if not exists idx_coupons_user_source on public.coupons(user_id, source);
create index if not exists idx_game_sessions_user_created_at on public.game_sessions(user_id, created_at desc);
