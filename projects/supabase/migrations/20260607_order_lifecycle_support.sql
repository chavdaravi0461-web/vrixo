-- Full order lifecycle + support tickets + returns
create table if not exists public.order_status_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  changed_by text not null default 'system',
  changed_by_id text,
  reason text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_order_status_logs_order_id on public.order_status_logs(order_id);
create index if not exists idx_order_status_logs_created_at on public.order_status_logs(created_at desc);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_number text not null,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'pickup_scheduled', 'pickup_done', 'item_received', 'refund_processed', 'completed', 'cancelled')),
  items jsonb not null default '[]'::jsonb,
  pickup_address jsonb,
  pickup_date timestamptz,
  pickup_slot text,
  courier text,
  tracking_number text,
  admin_notes text,
  resolved_by text,
  resolved_at timestamptz,
  refund_amount numeric(10,2),
  refund_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_return_requests_order_id on public.return_requests(order_id);
create index if not exists idx_return_requests_status on public.return_requests(status);
create index if not exists idx_return_requests_user_id on public.return_requests(user_id);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_number text not null unique,
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  subject text not null,
  description text not null,
  category text not null default 'general' check (category in ('order', 'payment', 'shipping', 'product', 'return', 'cancellation', 'account', 'general', 'complaint', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting_on_customer', 'waiting_on_admin', 'resolved', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  source text not null default 'web' check (source in ('web', 'whatsapp', 'email', 'phone', 'admin')),
  order_id uuid references public.orders(id) on delete set null,
  order_number text,
  metadata jsonb default '{}'::jsonb,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_support_tickets_status on public.support_tickets(status);
create index if not exists idx_support_tickets_user_id on public.support_tickets(user_id);
create index if not exists idx_support_tickets_phone on public.support_tickets(customer_phone);
create index if not exists idx_support_tickets_priority on public.support_tickets(priority);
create index if not exists idx_support_tickets_created_at on public.support_tickets(created_at desc);
create index if not exists idx_support_tickets_assigned on public.support_tickets(assigned_to);

create table if not exists public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  author_name text not null,
  author_role text not null default 'customer' check (author_role in ('customer', 'admin', 'system')),
  is_admin boolean not null default false,
  message text not null,
  attachments jsonb default '[]'::jsonb,
  internal_note boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists idx_ticket_replies_ticket_id on public.ticket_replies(ticket_id);

alter table public.orders
  add column if not exists return_status text,
  add column if not exists return_id uuid references public.return_requests(id) on delete set null,
  add column if not exists refund_id text,
  add column if not exists refund_amount numeric(10,2),
  add column if not exists refunded_at timestamptz,
  add column if not exists tracking_number text,
  add column if not exists courier text,
  add column if not exists estimated_delivery timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancellation_reason text;

create sequence if not exists ticket_number_seq start 1000 increment 1;

create or replace function public.generate_ticket_number()
returns text
language sql
security definer
set search_path = public
as $gen$
  select 'SUP-' || to_char(timezone('utc', now()), 'YYYYMMDD') || '-' || lpad(nextval('ticket_number_seq')::text, 4, '0');
$gen$;

create or replace function public.log_order_status(
  p_order_id uuid,
  p_from_status text,
  p_to_status text,
  p_changed_by text default 'system',
  p_changed_by_id text default null,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $log$
declare
  v_log_id uuid;
begin
  insert into public.order_status_logs (order_id, from_status, to_status, changed_by, changed_by_id, reason, metadata)
  values (p_order_id, p_from_status, p_to_status, p_changed_by, p_changed_by_id, p_reason, p_metadata)
  returning id into v_log_id;
  return v_log_id;
end;
$log$;

create or replace function public.create_support_ticket(
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text default null,
  p_subject text default 'Help Request',
  p_description text default null,
  p_category text default 'general',
  p_source text default 'whatsapp',
  p_order_id uuid default null,
  p_order_number text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $tkt$
declare
  v_ticket_id uuid;
  v_ticket_number text;
begin
  v_ticket_number := public.generate_ticket_number();
  insert into public.support_tickets (ticket_number, customer_name, customer_phone, customer_email, subject, description, category, source, order_id, order_number)
  values (v_ticket_number, p_customer_name, p_customer_phone, p_customer_email, p_subject, coalesce(p_description, p_subject), p_category, p_source, p_order_id, p_order_number)
  returning id into v_ticket_id;
  return v_ticket_id;
end;
$tkt$;

create or replace function public.create_return_request(
  p_order_id uuid,
  p_order_number text,
  p_customer_name text,
  p_customer_phone text,
  p_reason text,
  p_customer_email text default null,
  p_details text default null,
  p_items jsonb default '[]'::jsonb,
  p_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $ret$
declare
  v_return_id uuid;
begin
  insert into public.return_requests (order_id, order_number, user_id, customer_name, customer_phone, customer_email, reason, details, items)
  values (p_order_id, p_order_number, p_user_id, p_customer_name, p_customer_phone, p_customer_email, p_reason, p_details, p_items)
  returning id into v_return_id;
  update public.orders set return_status = 'requested', updated_at = timezone('utc', now()) where id = p_order_id;
  return v_return_id;
end;
$ret$;

create or replace function public.generate_ticket_number_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg$
begin
  if new.ticket_number is null then
    new.ticket_number := public.generate_ticket_number();
  end if;
  return new;
end;
$trg$;

drop trigger if exists trg_support_tickets_generate_number on public.support_tickets;
create trigger trg_support_tickets_generate_number
  before insert on public.support_tickets
  for each row execute function public.generate_ticket_number_trigger();

grant usage on sequence public.ticket_number_seq to service_role, authenticated;
grant execute on function public.generate_ticket_number() to service_role, authenticated;
grant execute on function public.log_order_status(uuid, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.create_support_ticket(text, text, text, text, text, text, text, uuid, text) to service_role, authenticated;
grant execute on function public.create_return_request(uuid, text, text, text, text, text, text, jsonb, uuid) to service_role, authenticated;
