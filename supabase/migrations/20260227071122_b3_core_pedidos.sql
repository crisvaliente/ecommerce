-- =========================================================
-- Workaround Supabase CLI (seed table)
-- =========================================================

create schema if not exists supabase_migrations;

create table if not exists supabase_migrations.seed_files (
  path text not null primary key,
  hash text not null
);

-- =========================================================
-- B3 CORE — Pedidos
-- Sección 1: Enums
-- =========================================================

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'pedido_estado') then
    create type public.pedido_estado as enum (
      'pendiente_pago',
      'pagado',
      'bloqueado',
      'en_preparacion',
      'enviado',
      'entregado',
      'cancelado'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'intento_pago_estado') then
    create type public.intento_pago_estado as enum (
      'iniciado',
      'aprobado',
      'rechazado',
      'expirado',
      'cancelado'
    );
  end if;
end $$;


-- =========================================================
-- Sección 2: Upgrade tabla pedido (existente) + backfill + endurecer
-- =========================================================

-- 2.1 Agregar columnas nuevas (nullable primero)
alter table public.pedido
  add column if not exists empresa_id uuid,
  add column if not exists total numeric(10,2),
  add column if not exists direccion_envio_snapshot jsonb,
  add column if not exists expira_en timestamptz,
  add column if not exists bloqueado_por_stock boolean not null default false,
  add column if not exists creado_en timestamptz,
  add column if not exists actualizado_en timestamptz;

-- 2.2 Backfill timestamps (normaliza legacy)
update public.pedido
set creado_en = coalesce(
  creado_en,
  case
    when fecha_pedido is not null then (fecha_pedido at time zone 'utc')
    else now()
  end
);

update public.pedido
set actualizado_en = coalesce(actualizado_en, creado_en, now());

-- 2.3 TTL default
update public.pedido
set expira_en = coalesce(expira_en, creado_en + interval '1 hour');

-- 2.4 Backfill empresa_id desde usuario.empresa_id cuando exista
update public.pedido p
set empresa_id = u.empresa_id
from public.usuario u
where p.empresa_id is null
  and p.usuario_id = u.id
  and u.empresa_id is not null;

-- 2.5 Backfill total (legacy -> 0 por defecto, B3 real lo setea RPC)
update public.pedido
set total = coalesce(total, 0);

-- 2.6 Snapshot dirección (FIX real, determinista)
-- 2.6a si hay direccion_envio_id válida
update public.pedido p
set direccion_envio_snapshot = jsonb_build_object(
  'direccion', d.direccion,
  'ciudad', d.ciudad,
  'pais', d.pais,
  'codigo_postal', d.codigo_postal,
  'tipo_direccion', d.tipo_direccion,
  'direccion_id', d.id,
  'usuario_id', d.usuario_id
)
from public.direccion_usuario d
where p.direccion_envio_snapshot is null
  and p.direccion_envio_id = d.id;

-- 2.6b fallback explícito (si no hay direccion o no existe)
update public.pedido p
set direccion_envio_snapshot = jsonb_build_object(
  'direccion', null,
  'ciudad', null,
  'pais', null,
  'codigo_postal', null,
  'tipo_direccion', null,
  'direccion_id', p.direccion_envio_id,
  'usuario_id', p.usuario_id
)
where p.direccion_envio_snapshot is null;


-- 2.7 Migrar estado varchar -> enum (con mapping conservador)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='pedido'
      and column_name='estado'
      and data_type='character varying'
  ) then
    -- limpiar default viejo incompatible
    alter table public.pedido
      alter column estado drop default;

    -- normalizar valores existentes
    update public.pedido
    set estado = case lower(coalesce(estado,'')) 
      when 'pagado' then 'pagado'
      when 'bloqueado' then 'bloqueado'
      when 'en_preparacion' then 'en_preparacion'
      when 'enviado' then 'enviado'
      when 'entregado' then 'entregado'
      when 'cancelado' then 'cancelado'
      when 'pendiente_pago' then 'pendiente_pago'
      when '' then 'pendiente_pago'
      else 'pendiente_pago'
    end;

    -- cambiar tipo
    alter table public.pedido
      alter column estado type public.pedido_estado
      using (estado::public.pedido_estado);

    -- nuevo default compatible
    alter table public.pedido
      alter column estado set default 'pendiente_pago'::public.pedido_estado;
  end if;
end $$;

-- 2.8 FAIL FAST: si hay legacy inválido, abortamos (como pediste)
do $$
declare
  v_null_empresa int;
  v_null_usuario int;
begin
  select count(*) into v_null_empresa from public.pedido where empresa_id is null;
  select count(*) into v_null_usuario from public.pedido where usuario_id is null;

  if v_null_empresa > 0 then
    raise exception 'B3: pedido.empresa_id tiene % filas NULL. Limpia/backfillea legacy antes de endurecer.', v_null_empresa;
  end if;

  if v_null_usuario > 0 then
    raise exception 'B3: pedido.usuario_id tiene % filas NULL. Limpia/backfillea legacy antes de endurecer.', v_null_usuario;
  end if;

  alter table public.pedido
    alter column empresa_id set not null,
    alter column usuario_id set not null,
    alter column total set not null,
    alter column direccion_envio_snapshot set not null,
    alter column expira_en set not null,
    alter column creado_en set not null,
    alter column actualizado_en set not null;
end $$;

-- 2.9 Invariante bloqueado
alter table public.pedido
  drop constraint if exists pedido_bloqueado_flag_chk,
  add constraint pedido_bloqueado_flag_chk
    check (
      (bloqueado_por_stock = true and estado = 'bloqueado')
      or (bloqueado_por_stock = false)
    );

-- 2.10 Índices operativos
create index if not exists pedido_empresa_creado_idx
  on public.pedido (empresa_id, creado_en desc);

create index if not exists pedido_usuario_creado_idx
  on public.pedido (usuario_id, creado_en desc);



  -- =========================================================
-- Sección 3: Tabla pedido_item
-- =========================================================

create table if not exists public.pedido_item (
  id uuid primary key default gen_random_uuid(),

  pedido_id uuid not null references public.pedido(id) on delete cascade,
  empresa_id uuid not null,

  producto_id uuid references public.producto(id) on delete set null,
  variante_id uuid references public.producto_variante(id) on delete set null,

  nombre_producto text not null,
  talle text,

  precio_unitario numeric(10,2) not null,
  cantidad integer not null check (cantidad > 0),

  subtotal numeric(10,2) generated always as (round(precio_unitario * cantidad, 2)) stored
);

-- índice para lecturas por pedido
create index if not exists pedido_item_pedido_idx
  on public.pedido_item (pedido_id);

create index if not exists pedido_item_empresa_idx
  on public.pedido_item (empresa_id);

-- invariante tenancy: empresa_id del item debe coincidir con empresa_id del pedido
create or replace function public.pedido_item_assert_empresa_match()
returns trigger
language plpgsql
as $$
declare v_empresa uuid;
begin
  select empresa_id into v_empresa
  from public.pedido
  where id = new.pedido_id;

  if v_empresa is null then
    raise exception 'pedido_item: pedido_id % no existe', new.pedido_id;
  end if;

  if new.empresa_id is distinct from v_empresa then
    raise exception 'pedido_item: empresa_id % no coincide con pedido.empresa_id % para pedido_id %',
      new.empresa_id, v_empresa, new.pedido_id;
  end if;

  return new;
end $$;

drop trigger if exists trg_pedido_item_assert_empresa_match on public.pedido_item;

create trigger trg_pedido_item_assert_empresa_match
before insert or update of pedido_id, empresa_id
on public.pedido_item
for each row
execute function public.pedido_item_assert_empresa_match();


commit;