-- Agregar estado (draft/published) para flujo B1
alter table public.producto
add column if not exists estado text;

alter table public.producto
alter column estado set default 'draft';

update public.producto
set estado = 'draft'
where estado is null;

alter table public.producto
alter column estado set not null;

-- Constraint para evitar valores inválidos
alter table public.producto
drop constraint if exists producto_estado_check;

alter table public.producto
add constraint producto_estado_check
check (estado in ('draft','published'));

-- Trigger: si estaba published y se edita => vuelve a draft (B1 estricto)
create or replace function public.producto_auto_draft_on_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if old.estado = 'published' then
    new.estado := 'draft';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_producto_auto_draft_on_update on public.producto;

create trigger trg_producto_auto_draft_on_update
before update on public.producto
for each row
execute function public.producto_auto_draft_on_update();
