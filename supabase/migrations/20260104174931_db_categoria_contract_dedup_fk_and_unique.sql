-- 0) Eliminar FK redundante (si existe)
alter table public.categoria
  drop constraint if exists categoria_empresa_id_fkey;

-- 1) Asegurar NOT NULL
alter table public.categoria
  alter column empresa_id set not null;

-- 2) Asegurar que exista fk_categoria_empresa con CASCADE
alter table public.categoria
  drop constraint if exists fk_categoria_empresa;

alter table public.categoria
  add constraint fk_categoria_empresa
  foreign key (empresa_id)
  references public.empresa(id)
  on delete cascade;

-- 3) Unicidad por empresa (case-insensitive)
create unique index if not exists ux_categoria_empresa_nombre_ci
  on public.categoria (empresa_id, lower(nombre));
