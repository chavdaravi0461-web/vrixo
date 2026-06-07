-- ============================================================
-- FINAL RLS POLICIES, RECOVERY SYSTEM & ANALYTICS
-- ============================================================
-- Run AFTER: 20260523_enterprise_fix_all.sql
-- ============================================================

-- ============================================================
-- 1. ADMIN RLS POLICIES (individual, no dynamic SQL)
-- ============================================================

drop policy if exists "admin_all_profiles" on public.profiles;
create policy "admin_all_profiles" on public.profiles
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_categories" on public.categories;
create policy "admin_all_categories" on public.categories
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_products" on public.products;
create policy "admin_all_products" on public.products
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_product_images" on public.product_images;
create policy "admin_all_product_images" on public.product_images
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_addresses" on public.addresses;
create policy "admin_all_addresses" on public.addresses
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_cart_items" on public.cart_items;
create policy "admin_all_cart_items" on public.cart_items
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_wishlists" on public.wishlists;
create policy "admin_all_wishlists" on public.wishlists
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_product_reviews" on public.product_reviews;
create policy "admin_all_product_reviews" on public.product_reviews
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_coupons" on public.coupons;
create policy "admin_all_coupons" on public.coupons
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_orders" on public.orders;
create policy "admin_all_orders" on public.orders
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_order_items" on public.order_items;
create policy "admin_all_order_items" on public.order_items
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_payments" on public.payments;
create policy "admin_all_payments" on public.payments
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_newsletter_subscriptions" on public.newsletter_subscriptions;
create policy "admin_all_newsletter_subscriptions" on public.newsletter_subscriptions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_newsletter_subscribers" on public.newsletter_subscribers;
create policy "admin_all_newsletter_subscribers" on public.newsletter_subscribers
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_contact_messages" on public.contact_messages;
create policy "admin_all_contact_messages" on public.contact_messages
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_carts" on public.carts;
create policy "admin_all_carts" on public.carts
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_razorpay_webhook_events" on public.razorpay_webhook_events;
create policy "admin_all_razorpay_webhook_events" on public.razorpay_webhook_events
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_rate_limits" on public.rate_limits;
create policy "admin_all_rate_limits" on public.rate_limits
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_admin_rate_limits" on public.admin_rate_limits;
create policy "admin_all_admin_rate_limits" on public.admin_rate_limits
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_order_notifications" on public.order_notifications;
create policy "admin_all_order_notifications" on public.order_notifications
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_order_notification_attempts" on public.order_notification_attempts;
create policy "admin_all_order_notification_attempts" on public.order_notification_attempts
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_fraud_alerts" on public.fraud_alerts;
create policy "admin_all_fraud_alerts" on public.fraud_alerts
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_fraud_blocklist" on public.fraud_blocklist;
create policy "admin_all_fraud_blocklist" on public.fraud_blocklist
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_customer_behavior_events" on public.customer_behavior_events;
create policy "admin_all_customer_behavior_events" on public.customer_behavior_events
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_app_events" on public.app_events;
create policy "admin_all_app_events" on public.app_events
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_admin_audit_logs" on public.admin_audit_logs;
create policy "admin_all_admin_audit_logs" on public.admin_audit_logs
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_game_sessions" on public.game_sessions;
create policy "admin_all_game_sessions" on public.game_sessions
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "admin_all_daily_game_rewards" on public.daily_game_rewards;
create policy "admin_all_daily_game_rewards" on public.daily_game_rewards
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ============================================================
-- 2. SUPPLEMENTARY RLS: service role bypass
-- ============================================================

-- ============================================================
-- 3. ADMIN DASHBOARD STATS FUNCTION (called via supabase.rpc)
-- ============================================================

create or replace function public.get_admin_dashboard_stats()
returns table (
  "totalProducts" bigint,
  "totalOrders" bigint,
  "totalUsers" bigint,
  "totalRevenue" numeric,
  "lowStockProducts" bigint,
  "newContacts" bigint,
  "pendingOrders" bigint,
  "onlinePaidOrders" bigint,
  "codOrders" bigint,
  "todayOrders" bigint,
  "todayRevenue" numeric,
  "completedOrders" bigint,
  "activeProducts" bigint,
  "pendingNotifications" bigint,
  "failedNotifications" bigint
)
language sql
stable
security definer
as $$
  select
    coalesce((select count(*) from public.products), 0)::bigint,
    coalesce((select count(*) from public.orders), 0)::bigint,
    coalesce((select count(*) from public.profiles), 0)::bigint,
    coalesce((select coalesce(sum(total), 0) from public.orders where order_status not in ('Cancelled', 'cancelled')), 0)::numeric,
    coalesce((select count(*) from public.products where stock <= 5), 0)::bigint,
    coalesce((select count(*) from public.contact_messages where status = 'new'), 0)::bigint,
    coalesce((select count(*) from public.orders where lower(order_status) = 'pending'), 0)::bigint,
    coalesce((select count(*) from public.orders where payment_method = 'online' and lower(payment_status) = 'paid'), 0)::bigint,
    coalesce((select count(*) from public.orders where lower(payment_method) = 'cod'), 0)::bigint,
    coalesce((select count(*) from public.orders where created_at >= current_date), 0)::bigint,
    coalesce((select coalesce(sum(total), 0) from public.orders where order_status not in ('Cancelled', 'cancelled') and created_at >= current_date), 0)::numeric,
    coalesce((select count(*) from public.orders where lower(order_status) = 'delivered'), 0)::bigint,
    coalesce((select count(*) from public.products where status = 'active'), 0)::bigint,
    coalesce((select count(*) from public.order_notifications where status in ('pending', 'retry_scheduled')), 0)::bigint,
    coalesce((select count(*) from public.order_notifications where status = 'failed'), 0)::bigint;
$$;

-- ============================================================
-- 4. RECOVERY & CLEANUP FUNCTIONS
-- ============================================================

create or replace function public.recover_abandoned_carts(hours_old int default 24)
returns table (cart_id uuid, user_id uuid, session_id text)
language plpgsql
security definer
as $$
begin
  return query
  update public.carts
  set abandoned = true
  where abandoned = false
    and updated_at < timezone('utc', now()) - (hours_old || ' hours')::interval
    and (user_id is not null or session_id is not null)
  returning id, user_id, session_id;
end;
$$;

create or replace function public.retry_failed_notifications(limit_count int default 50)
returns table (notification_id uuid, order_id uuid, provider text)
language plpgsql
security definer
as $$
begin
  return query
  update public.order_notifications
  set status = 'pending',
      last_error = null,
      next_retry_at = null,
      attempts = 0
  where id in (
    select id from public.order_notifications
    where status = 'failed'
      and attempts < max_attempts
    order by updated_at asc
    limit limit_count
    for update skip locked
  )
  returning id, order_id, provider;
end;
$$;

create or replace function public.cleanup_old_notification_attempts(retain_days int default 30)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.order_notification_attempts
  where created_at < timezone('utc', now()) - (retain_days || ' days')::interval;
end;
$$;

create or replace function public.cleanup_old_behavior_events(retain_days int default 90)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.customer_behavior_events
  where occurred_at < timezone('utc', now()) - (retain_days || ' days')::interval;
end;
$$;

create or replace function public.cleanup_old_app_events(retain_days int default 30)
returns void
language plpgsql
security definer
as $$
begin
  delete from public.app_events
  where created_at < timezone('utc', now()) - (retain_days || ' days')::interval;
end;
$$;

-- ============================================================
-- 5. ANALYTICS VIEWS
-- ============================================================

create or replace view public.v_daily_sales as
select
  date(created_at) as sale_date,
  count(*) as order_count,
  coalesce(sum(total), 0) as revenue,
  coalesce(sum(case when payment_method = 'cod' then total else 0 end), 0) as cod_revenue,
  coalesce(sum(case when payment_method = 'online' then total else 0 end), 0) as online_revenue,
  coalesce(avg(total), 0) as avg_order_value
from public.orders
where order_status not in ('cancelled', 'Cancelled')
group by date(created_at)
order by sale_date desc;

create or replace view public.v_top_products as
select
  oi.product_id,
  p.title,
  p.slug,
  p.category,
  p.sku,
  count(distinct oi.order_id) as order_count,
  sum(oi.quantity) as units_sold,
  sum(oi.price * oi.quantity) as revenue
from public.order_items oi
join public.products p on p.id = oi.product_id
join public.orders o on o.id = oi.order_id
where o.order_status not in ('cancelled', 'Cancelled')
group by oi.product_id, p.title, p.slug, p.category, p.sku
order by revenue desc;

create or replace view public.v_customer_ltv as
select
  o.user_id,
  p.name as customer_name,
  p.email,
  p.phone,
  count(distinct o.id) as order_count,
  coalesce(sum(o.total), 0) as total_spent,
  coalesce(avg(o.total), 0) as avg_order_value,
  max(o.created_at) as last_order_date,
  min(o.created_at) as first_order_date
from public.orders o
left join public.profiles p on p.id = o.user_id
where o.order_status not in ('cancelled', 'Cancelled')
group by o.user_id, p.name, p.email, p.phone
order by total_spent desc;

create or replace view public.v_payment_summary as
select
  payment_method,
  payment_status,
  count(*) as order_count,
  coalesce(sum(total), 0) as total_amount
from public.orders
group by payment_method, payment_status
order by payment_method, payment_status;

create or replace view public.v_whatsapp_delivery_status as
select
  whatsapp_status,
  count(*) as order_count,
  coalesce(sum(total), 0) as total_value
from public.orders
where whatsapp_status is not null
group by whatsapp_status;

-- ============================================================
-- 6. MATERIALIZED VIEWS
-- ============================================================

create materialized view if not exists public.mv_daily_sales as
select * from public.v_daily_sales
with data;

create unique index if not exists idx_mv_daily_sales_date on public.mv_daily_sales(sale_date);

create materialized view if not exists public.mv_top_products as
select * from public.v_top_products
with no data;

create unique index if not exists idx_mv_top_products_product_id on public.mv_top_products(product_id);

create or replace function public.refresh_dashboard_materialized_views()
returns void
language plpgsql
security definer
as $$
begin
  refresh materialized view concurrently public.mv_daily_sales;
  refresh materialized view concurrently public.mv_top_products;
end;
$$;

-- ============================================================
-- 7. SAFETY TRIGGERS
-- ============================================================

create or replace function public.prevent_paid_order_deletion()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.payment_status = 'paid' then
    raise exception 'Cannot delete an order with a paid payment.';
  end if;
  return old;
end;
$$;

drop trigger if exists orders_prevent_paid_deletion on public.orders;
create trigger orders_prevent_paid_deletion
before delete on public.orders
for each row execute function public.prevent_paid_order_deletion();

create or replace function public.prevent_payment_status_downgrade()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.payment_status = 'paid' and new.payment_status in ('pending', 'cod_pending', 'failed') then
    raise exception 'Cannot downgrade payment status from paid.';
  end if;
  return new;
end;
$$;

drop trigger if exists orders_prevent_payment_downgrade on public.orders;
create trigger orders_prevent_payment_downgrade
before update of payment_status on public.orders
for each row execute function public.prevent_payment_status_downgrade();

create or replace function public.auto_set_paid_at()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    new.paid_at = timezone('utc', now());
  end if;
  return new;
end;
$$;

drop trigger if exists orders_auto_set_paid_at on public.orders;
create trigger orders_auto_set_paid_at
before update of payment_status on public.orders
for each row execute function public.auto_set_paid_at();

create or replace function public.sync_payment_paid_at()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.payments
  set paid_at = new.paid_at,
      status = new.payment_status
  where order_id = new.id
    and paid_at is distinct from new.paid_at;
  return new;
end;
$$;

drop trigger if exists orders_sync_payment_paid_at on public.orders;
create trigger orders_sync_payment_paid_at
after update of paid_at, payment_status on public.orders
for each row execute function public.sync_payment_paid_at();

-- ============================================================
-- 8. ORPHANED RECORDS CLEANUP
-- ============================================================

delete from public.order_items oi
where not exists (select 1 from public.orders o where o.id = oi.order_id);

delete from public.payments p
where not exists (select 1 from public.orders o where o.id = p.order_id);

delete from public.order_notifications n
where not exists (select 1 from public.orders o where o.id = n.order_id);

delete from public.order_notification_attempts na
where not exists (select 1 from public.order_notifications n where n.id = na.notification_id);

delete from public.cart_items ci
where not exists (select 1 from public.products p where p.id = ci.product_id);

delete from public.wishlists w
where not exists (select 1 from public.products p where p.id = w.product_id);

delete from public.product_reviews r
where not exists (select 1 from public.products p where p.id = r.product_id);

delete from public.product_images pi
where not exists (select 1 from public.products p where p.id = pi.product_id);

-- ============================================================
-- 9. FINAL DATA INTEGRITY FIXES
-- ============================================================

update public.orders
set total_amount = total
where total_amount is null or total_amount = 0;

update public.orders
set whatsapp_status = 'pending'
where whatsapp_status is null;

update public.orders
set paid_at = updated_at
where payment_status = 'paid' and paid_at is null;

update public.orders
set payment_method = lower(payment_method)
where payment_method <> lower(payment_method);

-- ============================================================
-- 10. CRON-SAFE ENTRY POINT
-- ============================================================
-- select public.recover_failed_orders(6);
-- select public.cleanup_expired_rate_limits();
-- select public.cleanup_old_webhook_events();
-- select public.cleanup_stale_idempotency_keys();
-- select public.cleanup_old_notification_attempts();
-- select public.cleanup_old_behavior_events();
-- select public.cleanup_old_app_events();
-- select public.refresh_dashboard_materialized_views();
