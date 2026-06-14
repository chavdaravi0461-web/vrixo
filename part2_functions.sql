create or replace function public.enqueue_order_confirmation_whatsapp(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $enq$
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
$enq$;

create or replace function public.queue_order_confirmation_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = public
as $trg$
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
$trg$;

drop trigger if exists queue_order_confirmation_whatsapp_trigger on public.orders;
create trigger queue_order_confirmation_whatsapp_trigger
after insert or update of payment_status on public.orders
for each row execute function public.queue_order_confirmation_whatsapp();
