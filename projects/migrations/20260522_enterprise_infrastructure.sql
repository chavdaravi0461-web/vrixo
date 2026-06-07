-- Migration: Enterprise infrastructure tables

create table if not exists public.app_events (
  id uuid primary key,
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'warn', 'critical')),
  entity_id text,
  entity_type text,
  customer_id uuid references public.profiles(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_app_events_created on public.app_events(created_at desc);
create index if not exists idx_app_events_type on public.app_events(type);
create index if not exists idx_app_events_severity on public.app_events(severity);

alter table public.app_events enable row level security;

create table if not exists public.customer_behavior_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null default '',
  event_type text not null,
  path text,
  product_id uuid references public.products(id) on delete set null,
  category text,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_behavior_events_user on public.customer_behavior_events(user_id, occurred_at desc);
create index if not exists idx_behavior_events_session on public.customer_behavior_events(session_id, occurred_at desc);
create index if not exists idx_behavior_events_type on public.customer_behavior_events(event_type, occurred_at desc);

alter table public.customer_behavior_events enable row level security;

create table if not exists public.fraud_blocklist (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  device_fingerprint text,
  reason text not null default '',
  blocked_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_fraud_blocklist_email on public.fraud_blocklist(email);
create index if not exists idx_fraud_blocklist_phone on public.fraud_blocklist(phone);
create index if not exists idx_fraud_blocklist_device on public.fraud_blocklist(device_fingerprint);
create index if not exists idx_fraud_blocklist_active on public.fraud_blocklist(active) where active = true;

alter table public.fraud_blocklist enable row level security;

create table if not exists public.api_latency_metrics (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  method text not null,
  status integer,
  duration_ms integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_api_latency_created on public.api_latency_metrics(created_at desc);
create index if not exists idx_api_latency_route on public.api_latency_metrics(route);
