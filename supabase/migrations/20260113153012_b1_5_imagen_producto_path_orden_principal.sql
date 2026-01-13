begin;

alter table public.imagen_producto
  add column if not exists orden int not null default 0,
  add column if not exists es_principal boolean not null default false,
  add column if not exists path text;

-- Endurecemos producto_id (estás en 0 rows, entra perfecto)
alter table public.imagen_producto
  alter column producto_id set not null;

create index if not exists idx_ip_producto_orden
  on public.imagen_producto(producto_id, orden);

-- Único por producto+path (solo cuando path exista)
create unique index if not exists ux_ip_producto_path
  on public.imagen_producto(producto_id, path)
  where path is not null;

-- 1 sola principal por producto
create unique index if not exists ux_ip_one_principal_per_producto
  on public.imagen_producto(producto_id)
  where es_principal = true;

commit;
