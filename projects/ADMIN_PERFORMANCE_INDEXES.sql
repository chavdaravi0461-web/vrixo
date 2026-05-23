-- VRIXO admin performance indexes and dashboard stats RPC.
-- Safe to run multiple times. Does not drop or alter existing indexes.

create index if not exists idx_products_status_admin on public.products (status);
create index if not exists idx_products_category_admin on public.products (category);
create index if not exists idx_products_created_at_desc_admin on public.products (created_at desc);
create index if not exists idx_products_title_admin on public.products (title);
create index if not exists idx_products_slug_admin on public.products (slug);

create index if not exists idx_orders_created_at_desc_admin on public.orders (created_at desc);
create index if not exists idx_orders_order_status_admin on public.orders (order_status);
create index if not exists idx_orders_payment_status_admin on public.orders (payment_status);
create index if not exists idx_orders_payment_method_admin on public.orders (payment_method);
create index if not exists idx_orders_customer_phone_admin on public.orders (customer_phone);
create index if not exists idx_orders_customer_name_admin on public.orders (customer_name);

create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
      and coalesce(is_active, true) = true
  ) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'totalOrders', coalesce((select count(*) from public.orders), 0),
    'todayOrders', coalesce((select count(*) from public.orders where created_at >= date_trunc('day', now())), 0),
    'totalRevenue', coalesce((select sum(total) from public.orders where lower(coalesce(order_status, '')) not in ('cancelled')), 0),
    'todayRevenue', coalesce((select sum(total) from public.orders where created_at >= date_trunc('day', now()) and lower(coalesce(order_status, '')) not in ('cancelled')), 0),
    'pendingOrders', coalesce((select count(*) from public.orders where lower(coalesce(order_status, '')) in ('pending', 'processing')), 0),
    'completedOrders', coalesce((select count(*) from public.orders where lower(coalesce(order_status, '')) in ('delivered', 'completed')), 0),
    'codOrders', coalesce((select count(*) from public.orders where lower(coalesce(payment_method, '')) in ('cod', 'cash on delivery')), 0),
    'onlinePaidOrders', coalesce((select count(*) from public.orders where lower(coalesce(payment_status, '')) = 'paid'), 0),
    'lowStockProducts', coalesce((select count(*) from public.products where stock <= 5 and coalesce(status, 'active') = 'active'), 0),
    'activeProducts', coalesce((select count(*) from public.products where coalesce(status, 'active') = 'active'), 0),
    'totalProducts', coalesce((select count(*) from public.products), 0),
    'totalUsers', coalesce((select count(*) from public.profiles), 0),
    'newContacts', coalesce((select count(*) from public.contact_messages where coalesce(status, 'new') = 'new'), 0)
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
