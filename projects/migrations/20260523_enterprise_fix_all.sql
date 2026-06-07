-- ============================================================
-- ENTERPRISE FIXES: INFRASTRUCTURE TABLES, COLUMNS, RETRY SYSTEM
-- ============================================================
-- Run AFTER: 20260421_vrixo_schema.sql
-- Adds all missing tables, enterprise functions, views, retry logic
-- ============================================================

-- ============================================================
-- 1. INFRASTRUCTURE TABLES
-- ============================================================

-- 1a. Razorpay webhook deduplication
create table if not exists public.razorpay_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_name text not null,
  provider_order_id text,
  provider_payment_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- 1b. Rate limiting (public endpoints)
create table if not exists public.rate_limits (
  key text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null default timezone('utc', now()),
  blocked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

-- 1c. Rate limiting (admin endpoints)
create table if not exists public.admin_rate_limits (
  key text primary key,
  attempt_count integer not null default 0,
  reset_at timestamptz not null default timezone('utc', now()),
  blocked_until timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

-- 1d. Order notifications (WhatsApp/SMS queue)
create table if not exists public.order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null check (provider in ('sms', 'whatsapp')),
  event_type text not null check (event_type in ('order_confirmation', 'delivery_update', 'admin_alert')),
  payload jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retry_scheduled')),
  last_error text,
  next_retry_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 1e. Notification attempt audit trail
create table if not exists public.order_notification_attempts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.order_notifications(id) on delete cascade,
  provider text not null,
  event_type text not null,
  attempt integer not null default 1,
  status text not null check (status in ('sent', 'failed', 'retry_scheduled')),
  error text,
  response jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- 1f. Fraud alerts
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

-- 1g. Fraud blocklist
create table if not exists public.fraud_blocklist (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  device_fingerprint text,
  reason text not null default '',
  blocked_by uuid references public.profiles(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- 1h. Customer behavior events (analytics)
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

-- 1i. App events (internal event bus)
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

-- 1j. Admin audit logs
create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  admin_email text,
  action text not null,
  target_table text,
  target_id text,
  ip_address text,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

-- 1k. Game sessions
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  session_id text not null,
  mode text not null check (mode in ('coupon', 'daily')),
  score integer not null default 0,
  duration_seconds integer not null default 0,
  collected_items integer not null default 0,
  obstacles_hit integer not null default 0,
  reward_tier text,
  coupon_id uuid references public.coupons(id) on delete set null,
  is_valid boolean not null default true,
  invalid_reason text,
  created_at timestamptz not null default timezone('utc', now())
);

-- 1l. Daily game rewards
create table if not exists public.daily_game_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_date date not null default current_date,
  coupon_id uuid references public.coupons(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (user_id, reward_date)
);

-- ============================================================
-- 2. INFRASTRUCTURE INDEXES
-- ============================================================

create index if not exists idx_webhook_events_event_id on public.razorpay_webhook_events(event_id);
create index if not exists idx_webhook_events_created_at on public.razorpay_webhook_events(created_at desc);
create index if not exists idx_rate_limits_key on public.rate_limits(key);
create index if not exists idx_admin_rate_limits_key on public.admin_rate_limits(key);
create index if not exists idx_order_notifications_status on public.order_notifications(status, next_retry_at);
create index if not exists idx_order_notifications_order_id on public.order_notifications(order_id);
create index if not exists idx_notification_attempts_notification_id on public.order_notification_attempts(notification_id);
create index if not exists idx_fraud_alerts_order_id on public.fraud_alerts(order_id);
create index if not exists idx_fraud_blocklist_email on public.fraud_blocklist(email);
create index if not exists idx_fraud_blocklist_phone on public.fraud_blocklist(phone);
create index if not exists idx_behavior_events_user_id on public.customer_behavior_events(user_id);
create index if not exists idx_behavior_events_type on public.customer_behavior_events(event_type);
create index if not exists idx_behavior_events_occurred on public.customer_behavior_events(occurred_at desc);
create index if not exists idx_app_events_type on public.app_events(type);
create index if not exists idx_app_events_created on public.app_events(created_at desc);
create index if not exists idx_admin_audit_logs_admin on public.admin_audit_logs(admin_user_id);
create index if not exists idx_admin_audit_logs_action on public.admin_audit_logs(action);
create index if not exists idx_admin_audit_logs_created on public.admin_audit_logs(created_at desc);
create index if not exists idx_game_sessions_user on public.game_sessions(user_id);
create index if not exists idx_game_sessions_created on public.game_sessions(created_at desc);
create index if not exists idx_daily_rewards_user_date on public.daily_game_rewards(user_id, reward_date);

-- ============================================================
-- 3. ENTERPRISE FUNCTIONS
-- ============================================================

-- 3a. Idempotency claim (prevents duplicate COD/online orders)
create or replace function public.try_claim_idempotency_key(p_key text, p_order_id uuid, p_ttl_minutes int default 60)
returns boolean
language plpgsql
security definer
as $$
declare
  existing_order_id uuid;
begin
  select id into existing_order_id
  from public.orders
  where idempotency_key = p_key
  limit 1;
  if existing_order_id is not null then
    return false;
  end if;
  insert into public.orders (id, order_number, idempotency_key, items, shipping_address, subtotal, discount, shipping_charge, total, total_amount, payment_method, payment_status, order_status, customer_name, customer_phone, customer_email, notes)
  values (
    p_order_id,
    'RESERVED-' || p_key,
    p_key,
    '[]'::jsonb,
    '{}'::jsonb,
    0, 0, 0, 0, 0,
    'cod', 'pending', 'pending',
    '', '', '',
    jsonb_build_object('idempotency_reserved', true, 'reserved_at', timezone('utc', now()))
  )
  on conflict (idempotency_key) do nothing;
  select id into existing_order_id
  from public.orders
  where idempotency_key = p_key;
  return existing_order_id = p_order_id;
end;
$$;

-- 3b. Cleanup stale idempotency reservations
create or replace function public.cleanup_stale_idempotency_keys()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.orders
  where order_number like 'RESERVED-%'
    and (notes ->> 'reserved_at')::timestamptz < timezone('utc', now()) - interval '2 hours';
end;
$$;

-- 3c. Duplicate order detection
create or replace function public.detect_duplicate_order(
  p_user_id uuid, p_items jsonb, p_within_minutes int default 5
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  select count(*) into v_count
  from public.orders
  where user_id = p_user_id
    and items = p_items
    and created_at > timezone('utc', now()) - (p_within_minutes || ' minutes')::interval;
  return v_count > 0;
end;
$$;

-- 3d. Cleanup old webhook events (TTL: 7 days)
create or replace function public.cleanup_old_webhook_events()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.razorpay_webhook_events
  where created_at < timezone('utc', now()) - interval '7 days';
end;
$$;

-- 3e. Retry failed WhatsApp messages
create or replace function public.retry_failed_whatsapp_messages(limit_count int default 50)
returns table (order_id uuid, order_number text, customer_phone text)
language plpgsql
security definer
as $$
begin
  return query
  update public.orders
  set whatsapp_status = 'pending',
      whatsapp_error = null,
      retry_count = retry_count + 1
  where id in (
    select id from public.orders
    where whatsapp_status = 'failed'
      and retry_count < 5
      and customer_phone is not null
      and customer_phone <> ''
    order by updated_at asc
    limit limit_count
    for update skip locked
  )
  returning id, order_number, customer_phone;
end;
$$;

-- 3f. Recover stuck pending online orders
create or replace function public.recover_failed_orders(hours_old int default 2)
returns table (order_id uuid, order_number text)
language plpgsql
security definer
as $$
begin
  return query
  update public.orders
  set payment_status = 'failed',
      order_status = 'cancelled',
      last_error = 'Auto-recovered: payment timeout after ' || hours_old || ' hours'
  where payment_method = 'online'
    and payment_status in ('pending', 'cod_pending')
    and created_at < timezone('utc', now()) - (hours_old || ' hours')::interval
    and order_status not in ('delivered', 'cancelled')
  returning id, order_number;
end;
$$;

-- 3g. Cleanup expired rate limits
create or replace function public.cleanup_expired_rate_limits()
returns void
language plpgsql
security definer
as $$
begin
  delete from public.rate_limits
  where reset_at < timezone('utc', now()) - interval '1 day';
  delete from public.admin_rate_limits
  where reset_at < timezone('utc', now()) - interval '1 day';
end;
$$;

-- 3h. Reconcile pending payments (mark truly stuck as failed)
create or replace function public.reconcile_pending_payments(hours_old int default 24)
returns table (payment_id uuid, order_id uuid)
language plpgsql
security definer
as $$
begin
  return query
  update public.payments
  set status = 'failed',
      error_message = 'Auto-reconciled: pending for ' || hours_old || '+ hours'
  where status = 'pending'
    and created_at < timezone('utc', now()) - (hours_old || ' hours')::interval
  returning id, order_id;
end;
$$;

-- 3i. Atomic enterprise order creation
create or replace function public.create_order_atomic(
  p_user_id uuid,
  p_email text,
  p_shipping_address jsonb,
  p_items jsonb,
  p_subtotal numeric,
  p_discount numeric,
  p_shipping_charge numeric,
  p_total numeric,
  p_coupon_code text default null,
  p_payment_method text default 'cod',
  p_idempotency_key text default null
)
returns table (order_id uuid, order_number text, address_id uuid, customer_name text, customer_phone text, success boolean, error_message text)
language plpgsql
security definer
as $$
declare
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_address_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_existing_id uuid;
begin
  if p_idempotency_key is not null then
    select id into v_existing_id
    from public.orders
    where idempotency_key = p_idempotency_key
    limit 1;
    if v_existing_id is not null then
      return query
      select o.id, o.order_number, o.address_id, o.customer_name, o.customer_phone, true, 'Order already exists'
      from public.orders o where o.id = v_existing_id;
      return;
    end if;
  end if;

  v_order_number := 'DC-' || to_char(timezone('utc', now()), 'YYMMDD') || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 6));
  v_customer_name := coalesce(p_shipping_address ->> 'fullName', '');
  v_customer_phone := coalesce(p_shipping_address ->> 'phone', '');

  insert into public.addresses (user_id, full_name, phone, line1, line2, city, state, postal_code, country, landmark, is_default)
  values (p_user_id, v_customer_name, v_customer_phone,
    coalesce(p_shipping_address ->> 'line1', ''),
    nullif(p_shipping_address ->> 'line2', ''),
    coalesce(p_shipping_address ->> 'city', ''),
    coalesce(p_shipping_address ->> 'state', ''),
    coalesce(p_shipping_address ->> 'postalCode', ''),
    coalesce(p_shipping_address ->> 'country', 'India'),
    nullif(p_shipping_address ->> 'landmark', ''),
    false)
  returning id into v_address_id;

  insert into public.orders (id, order_number, user_id, address_id, items, subtotal, discount, shipping_charge, total, total_amount, payment_method, payment_status, order_status, shipping_address, customer_name, customer_phone, customer_email, coupon_code, idempotency_key, notes, whatsapp_status)
  values (v_order_id, v_order_number, p_user_id, v_address_id, p_items, p_subtotal, p_discount, p_shipping_charge, p_total, p_total,
    p_payment_method,
    case when p_payment_method = 'cod' then 'cod_pending' else 'pending' end,
    case when p_payment_method = 'cod' then 'pending' else 'pending' end,
    p_shipping_address, v_customer_name, v_customer_phone, p_email,
    upper(nullif(p_coupon_code, '')),
    p_idempotency_key,
    jsonb_build_object('email', p_email), 'pending');

  insert into public.order_items (order_id, product_id, title, sku, price, quantity, selected_size, selected_color, product_snapshot)
  select v_order_id,
    (item ->> 'productId')::uuid,
    coalesce(item ->> 'title', ''),
    coalesce(item ->> 'sku', ''),
    coalesce((item ->> 'price')::numeric, 0),
    coalesce((item ->> 'quantity')::int, 1),
    nullif(item ->> 'selectedSize', ''),
    nullif(item ->> 'selectedColor', ''),
    item
  from jsonb_array_elements(p_items) as item;

  insert into public.payments (order_id, provider, amount, currency, method, status, raw_response)
  values (v_order_id, 'manual', p_total, 'INR', p_payment_method,
    case when p_payment_method = 'cod' then 'cod_pending' else 'pending' end,
    jsonb_build_object('strictCheckout', true, 'idempotencyKey', p_idempotency_key));

  return query select v_order_id, v_order_number, v_address_id, v_customer_name, v_customer_phone, true, null::text;
exception when others then
  return query select null::uuid, null::text, null::uuid, null::text, null::text, false, SQLERRM::text;
end;
$$;

-- ============================================================
-- 4. ENTERPRISE VIEWS
-- ============================================================

-- 4a. Pending COD orders needing admin review
create or replace view public.v_pending_cod_orders as
select
  o.id, o.order_number, o.user_id, o.created_at,
  o.customer_name, o.customer_phone, o.customer_email,
  o.total, o.items, o.shipping_address,
  o.coupon_code, o.notes,
  p.name as user_name, p.email as user_email, p.phone as user_phone
from public.orders o
left join public.profiles p on p.id = o.user_id
where o.payment_method = 'cod'
  and o.payment_status = 'cod_pending'
  and o.order_status = 'pending';

-- 4b. Failed payments needing review
create or replace view public.v_failed_payments as
select
  o.id, o.order_number, o.user_id, o.created_at,
  o.customer_name, o.customer_phone, o.customer_email,
  o.total, o.payment_method, o.payment_status, o.order_status,
  o.razorpay_order_id, o.razorpay_payment_id,
  o.last_error, o.retry_count,
  pm.status as payment_status_detail,
  pm.error_message as payment_error
from public.orders o
left join public.payments pm on pm.order_id = o.id
where o.payment_status = 'failed'
   or (o.payment_method = 'online' and o.payment_status = 'pending'
       and o.created_at < timezone('utc', now()) - interval '1 hour');

-- 4c. Recent fraud alerts
create or replace view public.v_active_fraud_alerts as
select
  fa.id, fa.order_id, fa.alert_type, fa.fraud_score,
  fa.details, fa.created_at,
  o.order_number, o.customer_name, o.customer_phone, o.total
from public.fraud_alerts fa
left join public.orders o on o.id = fa.order_id
where fa.resolved = false
order by fa.created_at desc;

-- ============================================================
-- 5. DATA NORMALIZATION & CLEANUP
-- ============================================================

-- Normalize COD payment methods
update public.orders
set payment_method = 'cod'
where lower(coalesce(payment_method, '')) in ('cash on delivery', 'cod');

-- Normalize online payment methods
update public.orders
set payment_method = 'online'
where lower(coalesce(payment_method, '')) in ('online', 'online payment');

-- Ensure total_amount is synced
update public.orders
set total_amount = total
where total_amount is null or total_amount = 0;

-- Ensure all existing orders have whatsapp_status
update public.orders
set whatsapp_status = 'pending'
where whatsapp_status is null;

-- Normalize payment statuses (code uses 'paid' lowercase)
update public.payments
set status = 'paid'
where status in ('Paid', 'captured', 'success', 'confirmed');

update public.payments
set status = 'cod_pending'
where status = 'pending' and method = 'cod';

-- Normalize order statuses (code uses lowercase)
update public.orders
set order_status = lower(order_status)
where order_status <> lower(order_status);

-- ============================================================
-- 6. SAFETY TRIGGER: prevent orphaned records on order delete
-- ============================================================

create or replace function public.prevent_orphaned_payment_on_order_delete()
returns trigger
language plpgsql
security definer
as $$
begin
  delete from public.payments where order_id = old.id;
  delete from public.order_items where order_id = old.id;
  delete from public.order_notifications where order_id = old.id;
  return old;
end;
$$;

drop trigger if exists orders_cascade_cleanup on public.orders;
create trigger orders_cascade_cleanup
before delete on public.orders
for each row execute procedure public.prevent_orphaned_payment_on_order_delete();

-- ============================================================
-- 7. RLS ON INFRASTRUCTURE TABLES
-- ============================================================

do $$
declare
  t text;
  tables text[] := array[
    'razorpay_webhook_events', 'rate_limits', 'admin_rate_limits',
    'order_notifications', 'order_notification_attempts',
    'fraud_alerts', 'fraud_blocklist',
    'customer_behavior_events', 'app_events',
    'admin_audit_logs', 'game_sessions', 'daily_game_rewards'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end;
$$;
