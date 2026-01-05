create or replace function sync_producto_categoria_compat()
returns trigger
language plpgsql
as $$
begin
  if new.categoria_id is null then
    delete from producto_categoria
    where empresa_id = new.empresa_id
      and producto_id = new.id;
    return new;
  end if;

  delete from producto_categoria
  where empresa_id = new.empresa_id
    and producto_id = new.id
    and categoria_id <> new.categoria_id;

  insert into producto_categoria (empresa_id, producto_id, categoria_id, created_at)
  values (new.empresa_id, new.id, new.categoria_id, now())
  on conflict (empresa_id, producto_id, categoria_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_sync_producto_categoria_compat on producto;

create trigger trg_sync_producto_categoria_compat
after insert or update of categoria_id on producto
for each row
execute function sync_producto_categoria_compat();
