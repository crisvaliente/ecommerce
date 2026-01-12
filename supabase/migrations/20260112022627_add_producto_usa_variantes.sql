alter table public.producto
add column if not exists usa_variantes boolean not null default false;

update public.producto p
set usa_variantes = true
where exists (
  select 1
  from public.producto_variante v
  where v.empresa_id = p.empresa_id
    and v.producto_id = p.id
);
