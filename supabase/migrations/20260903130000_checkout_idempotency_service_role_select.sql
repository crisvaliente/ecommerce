begin;

revoke all privileges on table public.checkout_pedido_idempotencia from service_role;
grant select on table public.checkout_pedido_idempotencia to service_role;

commit;
