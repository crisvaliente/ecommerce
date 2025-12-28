-- 1) empresa_id obligatorio
alter table producto
alter column empresa_id set not null;

-- 2) estado obligatorio
alter table producto
alter column estado set not null;

-- 3) estado con valores válidos
alter table producto
add constraint producto_estado_valido
check (
  estado in ('draft', 'published', 'paused', 'archived')
);
