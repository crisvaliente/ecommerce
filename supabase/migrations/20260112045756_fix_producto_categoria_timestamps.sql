begin;

-- Agregar created_at si no existe
alter table public.producto_categoria
add column if not exists created_at timestamptz not null default now();

-- Agregar updated_at si no existe
alter table public.producto_categoria
add column if not exists updated_at timestamptz not null default now();

-- Trigger para mantener updated_at (si no existe ya)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_producto_categoria_updated_at on public.producto_categoria;
create trigger trg_producto_categoria_updated_at
before update on public.producto_categoria
for each row
execute function public.set_updated_at();

commit;
