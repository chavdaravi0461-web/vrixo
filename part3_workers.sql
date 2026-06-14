create or replace function public.claim_order_notifications(
  p_limit integer default 25,
  p_worker_id text default null,
  p_lease_seconds integer default 120
)
returns setof public.order_notifications
language plpgsql
security definer
set search_path = public
as $clm$
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
$clm$;

create or replace function public.claim_order_notification(
  p_notification_id uuid,
  p_worker_id text default null,
  p_lease_seconds integer default 120
)
returns public.order_notifications
language plpgsql
security definer
set search_path = public
as $clm1$
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
$clm1$;

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
as $cmp$
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
$cmp$;
