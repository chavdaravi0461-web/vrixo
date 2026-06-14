-- Durable WhatsApp order-confirmation outbox for Vrixo.
-- Apply after the existing order_notifications migrations.

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

create or replace function public.enqueue_order_confirmation_whatsapp(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_notification_id uuid;
  v_product_names text;
  v_total_qty integer;
begin
  select * into v_order
  from public.orders
  where id = p_order_id;

  if not found then
    raise exception 'Order % not found', p_order_id;
  end if;

  if v_order.payment_method = 'online' and v_order.payment_status <> 'paid' then
    return null;
  end if;

  select
    coalesce(string_agg(nullif(item ->> 'title', ''), ', '), 'Vrixo product'),
    coalesce(sum(greatest(coalesce((item ->> 'quantity')::integer, 1), 1)), 0)
  into v_product_names, v_total_qty
  from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb)) item;

  insert into public.order_notifications (
    order_id,
    provider,
    event_type,
    dedupe_key,
    payload,
    max_attempts,
    status,
    next_retry_at
  )
  values (
    v_order.id,
    'whatsapp',
    'order_confirmation',
    'whatsapp:order_confirmation:' || v_order.id::text,
    jsonb_build_object(
      'customerName', coalesce(nullif(v_order.customer_name, ''), 'Customer'),
      'customerPhone', coalesce(v_order.customer_phone, ''),
      'orderNumber', v_order.order_number,
      'productNames', v_product_names,
      'totalQty', v_total_qty,
      'totalAmount', coalesce(v_order.total, 0),
      'orderStatus', coalesce(v_order.order_status, 'pending'),
      'paymentMethod', coalesce(v_order.payment_method, 'cod'),
      'paymentStatus', coalesce(v_order.payment_status, 'pending'),
      'deliveryAddress', coalesce(v_order.shipping_address, '{}'::jsonb)
    ),
    8,
    'pending',
    timezone('utc', now())
  )
  on conflict (dedupe_key) where dedupe_key is not null
  do update set
    payload = excluded.payload,
    updated_at = timezone('utc', now())
  returning id into v_notification_id;

  return v_notification_id;
end;
$$;

create or replace function public.queue_order_confirmation_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_method = 'cod' or new.payment_status = 'paid' then
      perform public.enqueue_order_confirmation_whatsapp(new.id);
    end if;
  elsif new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    perform public.enqueue_order_confirmation_whatsapp(new.id);
  end if;

  return new;
end;
$$;

drop trigger if exists queue_order_confirmation_whatsapp_trigger on public.orders;
create trigger queue_order_confirmation_whatsapp_trigger
after insert or update of payment_status on public.orders
for each row execute function public.queue_order_confirmation_whatsapp();

create or replace function public.claim_order_notifications(
  p_limit integer default 25,
  p_worker_id text default null,
  p_lease_seconds integer default 120
)
returns setof public.order_notifications
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with candidates as (
    select id
    from public.order_notifications
    where provider = 'whatsapp'
      and attempts < max_attempts
      and (
        status in ('pending', 'retry_scheduled')
        or (status = 'processing' and lease_expires_at < timezone('utc', now()))
      )
      and coalesce(next_retry_at, timezone('utc', now())) <= timezone('utc', now())
    order by created_at asc
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.order_notifications n
  set status = 'processing',
      attempts = n.attempts + 1,
      claimed_at = timezone('utc', now()),
      lease_expires_at = timezone('utc', now()) + make_interval(secs => greatest(30, p_lease_seconds)),
      locked_by = coalesce(nullif(p_worker_id, ''), gen_random_uuid()::text),
      updated_at = timezone('utc', now())
  from candidates
  where n.id = candidates.id
  returning n.*;
end;
$$;

create or replace function public.claim_order_notification(
  p_notification_id uuid,
  p_worker_id text default null,
  p_lease_seconds integer default 120
)
returns public.order_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.order_notifications;
begin
  update public.order_notifications
  set status = 'processing',
      attempts = attempts + 1,
      claimed_at = timezone('utc', now()),
      lease_expires_at = timezone('utc', now()) + make_interval(secs => greatest(30, p_lease_seconds)),
      locked_by = coalesce(nullif(p_worker_id, ''), gen_random_uuid()::text),
      updated_at = timezone('utc', now())
  where id = p_notification_id
    and provider = 'whatsapp'
    and attempts < max_attempts
    and (
      status in ('pending', 'retry_scheduled')
      or (status = 'processing' and lease_expires_at < timezone('utc', now()))
    )
    and coalesce(next_retry_at, timezone('utc', now())) <= timezone('utc', now())
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.complete_order_notification(
  p_notification_id uuid,
  p_sent boolean,
  p_provider_message_id text default null,
  p_error text default null,
  p_error_code text default null,
  p_response jsonb default null,
  p_next_retry_at timestamptz default null
)
returns public.order_notifications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result public.order_notifications;
begin
  update public.order_notifications
  set status = case
        when p_sent then 'sent'
        when attempts >= max_attempts then 'failed'
        else 'retry_scheduled'
      end,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      delivery_status = case when p_sent then 'accepted' else delivery_status end,
      last_error = p_error,
      error_code = p_error_code,
      provider_response = p_response,
      next_retry_at = case
        when p_sent or attempts >= max_attempts then null
        else p_next_retry_at
      end,
      sent_at = case when p_sent then timezone('utc', now()) else sent_at end,
      lease_expires_at = null,
      locked_by = null,
      updated_at = timezone('utc', now())
  where id = p_notification_id
  returning * into v_result;

  if v_result.id is null then
    raise exception 'Notification % not found', p_notification_id;
  end if;

  update public.orders
  set whatsapp_status = case
        when p_sent then 'sent'
        when v_result.status = 'failed' then 'failed'
        else 'pending'
      end,
      whatsapp_error = p_error,
      updated_at = timezone('utc', now())
  where id = v_result.order_id;

  return v_result;
end;
$$;

revoke all on function public.enqueue_order_confirmation_whatsapp(uuid) from public, anon, authenticated;
revoke all on function public.claim_order_notifications(integer, text, integer) from public, anon, authenticated;
revoke all on function public.claim_order_notification(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.complete_order_notification(uuid, boolean, text, text, text, jsonb, timestamptz) from public, anon, authenticated;

grant execute on function public.enqueue_order_confirmation_whatsapp(uuid) to service_role;
grant execute on function public.claim_order_notifications(integer, text, integer) to service_role;
grant execute on function public.claim_order_notification(uuid, text, integer) to service_role;
grant execute on function public.complete_order_notification(uuid, boolean, text, text, text, jsonb, timestamptz) to service_role;
