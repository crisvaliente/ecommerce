create or replace function public.producto_auto_draft_on_update()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Si el estado cambia explícitamente (draft <-> published), respetarlo
  if new.estado is distinct from old.estado then
    return new;
  end if;

  -- Si estaba publicado y cambió algo "real" (ignorando estado/updated_at),
  -- entonces sí: volver a draft
  if old.estado = 'published' then
    if (to_jsonb(new) - 'estado' - 'updated_at')
       is distinct from
       (to_jsonb(old) - 'estado' - 'updated_at') then
      new.estado := 'draft';
    end if;
  end if;

  return new;
end;
$$;