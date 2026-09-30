begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Production has a permissive SELECT policy on imagen_producto that no migration
-- in this repository creates (manual change, found in the 2026-09-30 survey).
-- Gate 3 (20260914165851) replaces every catalog policy with exactly 20 canonical
-- ones and fails closed when any other policy remains; left in place, this one
-- would also widen image access through permissive OR. No-op where it is absent.
drop policy if exists ip_sel_owner on public.imagen_producto;

commit;
