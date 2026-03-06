-- =========================================================
-- B3 — intento_pago (estructura inicial)
-- Entidad transaccional de intentos de cobro por pedido
-- =========================================================

-- ---------------------------------------------------------
-- 1. ENUM canal_pago_tipo
-- ---------------------------------------------------------

create type canal_pago_tipo as enum (
  'mercadopago',
  'transferencia',
  'efectivo'
);


-- ---------------------------------------------------------
-- 2. TABLA intento_pago
-- ---------------------------------------------------------

create table public.intento_pago (

  id uuid primary key default gen_random_uuid(),

  pedido_id uuid not null,
  empresa_id uuid not null,

  estado intento_pago_estado not null default 'iniciado',

  canal_pago canal_pago_tipo not null,

  external_id text null,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()

);


-- ---------------------------------------------------------
-- 3. FK pedido
-- ---------------------------------------------------------

alter table public.intento_pago
add constraint fk_intento_pago_pedido
foreign key (pedido_id)
references public.pedido(id)
on delete cascade;


-- ---------------------------------------------------------
-- 4. ÍNDICES BASE
-- ---------------------------------------------------------

create index idx_intento_pago_pedido
on public.intento_pago (pedido_id);

create index idx_intento_pago_empresa_creado
on public.intento_pago (empresa_id, creado_en desc);

create index idx_intento_pago_estado
on public.intento_pago (estado);


-- ---------------------------------------------------------
-- 5. UNIQUE: (canal_pago, external_id) cuando external_id existe
-- ---------------------------------------------------------

create unique index ux_intento_pago_external
on public.intento_pago (canal_pago, external_id)
where external_id is not null;


-- ---------------------------------------------------------
-- 6. INVARIANTE: un intento aprobado por pedido
-- ---------------------------------------------------------

create unique index ux_intento_pago_aprobado_por_pedido
on public.intento_pago (pedido_id)
where estado = 'aprobado';


-- ---------------------------------------------------------
-- 7. FUNCIÓN: asegurar coherencia empresa_id ↔ pedido
-- ---------------------------------------------------------

create or replace function public.intento_pago_assert_empresa_match()
returns trigger
language plpgsql
as $$
declare
  v_empresa uuid;
begin

  select empresa_id
  into v_empresa
  from public.pedido
  where id = new.pedido_id;

  if v_empresa is null then
    raise exception
    'intento_pago: pedido_id % no existe',
    new.pedido_id;
  end if;

  if new.empresa_id is distinct from v_empresa then
    raise exception
    'intento_pago: empresa_id % no coincide con pedido.empresa_id % para pedido_id %',
    new.empresa_id, v_empresa, new.pedido_id;
  end if;

  return new;

end;
$$;


-- ---------------------------------------------------------
-- 8. TRIGGER: validar empresa_id
-- ---------------------------------------------------------

create trigger trg_intento_pago_assert_empresa_match
before insert or update
on public.intento_pago
for each row
execute function public.intento_pago_assert_empresa_match();


-- ---------------------------------------------------------
-- 9. FUNCIÓN timestamp actualizado_en
-- ---------------------------------------------------------

create or replace function public.set_intento_pago_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;


-- ---------------------------------------------------------
-- 10. TRIGGER actualizado_en
-- ---------------------------------------------------------

create trigger trg_intento_pago_set_actualizado_en
before update
on public.intento_pago
for each row
execute function public.set_intento_pago_actualizado_en();


-- ---------------------------------------------------------
-- 11. RLS
-- ---------------------------------------------------------

alter table public.intento_pago enable row level security;


-- ---------------------------------------------------------
-- 12. POLICIES
-- ---------------------------------------------------------

create policy intento_pago_sel_own
on public.intento_pago
for select
to authenticated
using (public.owns_pedido(pedido_id));

create policy intento_pago_ins_own
on public.intento_pago
for insert
to authenticated
with check (public.owns_pedido(pedido_id));

create policy intento_pago_upd_own
on public.intento_pago
for update
to authenticated
using (public.owns_pedido(pedido_id))
with check (public.owns_pedido(pedido_id));

create policy intento_pago_del_own
on public.intento_pago
for delete
to authenticated
using (public.owns_pedido(pedido_id));