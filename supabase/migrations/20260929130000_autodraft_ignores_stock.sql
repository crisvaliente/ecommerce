begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- A published product returns to draft when its content changes, so it is
-- reviewed before selling again. Stock is operational, not content: every
-- consolidated sale (consolidar_pago_pedido) updates producto.stock, and
-- counting it as an edit unpublished simple products after their first sale.
create or replace function public.producto_auto_draft_on_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- An explicit estado change (draft <-> published) is respected.
  if new.estado is distinct from old.estado then
    return new;
  end if;

  if old.estado = 'published'
     and (to_jsonb(new) - 'estado' - 'updated_at' - 'stock')
       is distinct from (to_jsonb(old) - 'estado' - 'updated_at' - 'stock') then
    new.estado := 'draft';
  end if;

  return new;
end;
$$;

commit;
