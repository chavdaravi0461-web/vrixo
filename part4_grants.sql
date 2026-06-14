revoke all on function public.enqueue_order_confirmation_whatsapp(uuid) from public, anon, authenticated;
revoke all on function public.claim_order_notifications(integer, text, integer) from public, anon, authenticated;
revoke all on function public.claim_order_notification(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.complete_order_notification(uuid, boolean, text, text, text, jsonb, timestamptz) from public, anon, authenticated;

grant execute on function public.enqueue_order_confirmation_whatsapp(uuid) to service_role;
grant execute on function public.claim_order_notifications(integer, text, integer) to service_role;
grant execute on function public.claim_order_notification(uuid, text, integer) to service_role;
grant execute on function public.complete_order_notification(uuid, boolean, text, text, text, jsonb, timestamptz) to service_role;
