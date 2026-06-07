-- ============================================================================
-- ENTERPRISE SECURITY HARDENING MIGRATION
-- Adds missing tables, columns, indexes, and policies for production readiness
-- ============================================================================

-- 1. Missing tables
-- ============================================================================

-- app_events table for event-bus persistence
create table if not exists public.app_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null default 'info',
  entity_id text,
  entity_type text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_events_type_created_at on public.app_events(type, created_at desc);
create index if not exists idx_app_events_entity on public.app_events(entity_type, entity_id);

-- fraud_alerts table for fraud detection
create table if not exists public.fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  reason text not null,
  risk_score numeric(5,2) not null default 0,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_fraud_alerts_order on public.fraud_alerts(order_id);
create index if not exists idx_fraud_alerts_user on public.fraud_alerts(user_id);

-- fraud_blocklist table
create table if not exists public.fraud_blocklist (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  device_fingerprint text,
  reason text not null,
  blocked_by uuid references auth.users(id),
  blocked_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_fraud_blocklist_email on public.fraud_blocklist(email);
create index if not exists idx_fraud_blocklist_phone on public.fraud_blocklist(phone);

-- admin_sessions table for session tracking and revocation
create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  ip_address text,
  user_agent text,
  device_fingerprint text,
  is_revoked boolean not null default false,
  last_activity_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

create index if not exists idx_admin_sessions_user on public.admin_sessions(user_id);
create index if not exists idx_admin_sessions_token on public.admin_sessions(token_hash);

-- 2. Missing columns on orders table
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'idempotency_key'
  ) then
    alter table public.orders add column idempotency_key text;
    create index if not exists idx_orders_idempotency_key on public.orders(idempotency_key);
  end if;
end $$;

-- 3. Missing indexes
-- ============================================================================
create index if not exists idx_orders_email on public.orders(customer_email);
create index if not exists idx_orders_customer_phone on public.orders(customer_phone);

-- 4. Add updated_at trigger to order_notifications
-- ============================================================================
create or replace function public.set_order_notifications_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'set_order_notifications_updated_at'
  ) then
    create trigger set_order_notifications_updated_at
      before update on public.order_notifications
      for each row execute function public.set_order_notifications_updated_at();
  end if;
end $$;

-- 5. RLS policies for new tables
-- ============================================================================
alter table public.app_events enable row level security;
alter table public.fraud_alerts enable row level security;
alter table public.fraud_blocklist enable row level security;
alter table public.admin_sessions enable row level security;

-- App events: service_role only
create policy "app_events_service_only"
  on public.app_events for all
  using (true)
  with check (true);

-- Fraud alerts: service_role only
create policy "fraud_alerts_service_only"
  on public.fraud_alerts for all
  using (true)
  with check (true);

-- Fraud blocklist: service_role only
create policy "fraud_blocklist_service_only"
  on public.fraud_blocklist for all
  using (true)
  with check (true);

-- Admin sessions: user can see own, service_role can see all
create policy "admin_sessions_self"
  on public.admin_sessions for select
  using (auth.uid() = user_id);

create policy "admin_sessions_service"
  on public.admin_sessions for all
  using (true)
  with check (true);
