-- Migration: Enterprise fraud detection infrastructure
create table if not exists public.fraud_alerts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  alert_type text not null default 'manual',
  fraud_score numeric(5,2) not null default 0,
  details jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_fraud_alerts_order_id on public.fraud_alerts(order_id);
create index if not exists idx_fraud_alerts_resolved on public.fraud_alerts(resolved) where resolved = false;

alter table public.fraud_alerts enable row level security;
