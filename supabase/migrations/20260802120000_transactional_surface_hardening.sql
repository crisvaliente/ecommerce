begin;

alter table public.pedido enable row level security;
alter table public.pedido_item enable row level security;
alter table public.intento_pago enable row level security;

-- Historical buyer policies are no longer part of the transactional access contract.
-- Buyer reads remain available through ownership-checking server-side APIs.
drop policy if exists insert_own_pedidos on public.pedido;
drop policy if exists pedido_del_own on public.pedido;
drop policy if exists pedido_ins_own on public.pedido;
drop policy if exists pedido_sel_own on public.pedido;
drop policy if exists pedido_upd_own on public.pedido;
drop policy if exists read_own_pedidos on public.pedido;

drop policy if exists intento_pago_sel_own on public.intento_pago;
drop policy if exists intento_pago_ins_own on public.intento_pago;
drop policy if exists intento_pago_upd_own on public.intento_pago;
drop policy if exists intento_pago_del_own on public.intento_pago;

revoke all privileges
on table public.pedido, public.pedido_item, public.intento_pago
from public, anon, authenticated;

commit;
