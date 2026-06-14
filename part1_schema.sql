create extension if not exists pgcrypto;

alter table public.order_notifications
  add column if not exists dedupe_key text,
  add column if not exists provider_message_id text,
  add column if not exists delivery_status text,
  add column if not exists error_code text,
  add column if not exists provider_response jsonb,
  add column if not exists claimed_at timestamptz,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists locked_by text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz;

alter table public.order_notifications drop constraint if exists order_notifications_status_check;
alter table public.order_notifications add constraint order_notifications_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'retry_scheduled'));

create unique index if not exists idx_order_notifications_dedupe_key
  on public.order_notifications(dedupe_key)
  where dedupe_key is not null;

create unique index if not exists idx_order_notifications_provider_message_id
  on public.order_notifications(provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_order_notifications_claimable
  on public.order_notifications(status, next_retry_at, lease_expires_at, created_at)
  where provider = 'whatsapp';
