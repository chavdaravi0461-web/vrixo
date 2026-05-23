create table if not exists public.app_events (
  id uuid primary key,
  type text not null,
  severity text not null default 'info',
  entity_id text,
  entity_type text,
  customer_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_events_created_at_idx on public.app_events (created_at desc);
create index if not exists app_events_type_idx on public.app_events (type);
create index if not exists app_events_severity_idx on public.app_events (severity);

create table if not exists public.customer_behavior_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  session_id text not null,
  event_type text not null,
  path text,
  product_id uuid,
  category text,
  value numeric,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists customer_behavior_events_user_idx on public.customer_behavior_events (user_id, occurred_at desc);
create index if not exists customer_behavior_events_session_idx on public.customer_behavior_events (session_id, occurred_at desc);
create index if not exists customer_behavior_events_type_idx on public.customer_behavior_events (event_type, occurred_at desc);

create table if not exists public.fraud_blocklist (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  device_fingerprint text,
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists fraud_blocklist_email_idx on public.fraud_blocklist (email);
create index if not exists fraud_blocklist_phone_idx on public.fraud_blocklist (phone);
create index if not exists fraud_blocklist_device_idx on public.fraud_blocklist (device_fingerprint);

create table if not exists public.api_latency_metrics (
  id uuid primary key default gen_random_uuid(),
  route text not null,
  method text not null,
  status integer,
  duration_ms integer not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists api_latency_metrics_created_idx on public.api_latency_metrics (created_at desc);
