-- Contrato fuerte para categoria

-- 1) Default para id
alter table categoria
  alter column id set default gen_random_uuid();

-- 2) Invariantes básicas
alter table categoria
  alter column empresa_id set not null,
  alter column nombre set not null;

-- 3) FK hacia empresa
alter table categoria
  add constraint fk_categoria_empresa
  foreign key (empresa_id) references empresa(id)
  on delete cascade;

-- 4) Unique por empresa (case-insensitive)
create unique index if not exists ux_categoria_empresa_nombre_ci
  on categoria (empresa_id, lower(nombre));
