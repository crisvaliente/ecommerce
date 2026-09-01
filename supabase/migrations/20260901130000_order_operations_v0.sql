begin;

alter table public.pedido
  drop constraint if exists pedido_pagado_requiere_intento_consolidado_chk;

alter table public.pedido
  add constraint pedido_estados_operativos_requieren_pago_consolidado_chk
  check (
    estado not in (
      'pagado'::public.pedido_estado,
      'en_preparacion'::public.pedido_estado,
      'enviado'::public.pedido_estado,
      'entregado'::public.pedido_estado
    )
    or intento_pago_consolidado_id is not null
  );

create table public.pedido_estado_evento (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedido(id) on delete cascade,
  empresa_id uuid not null references public.empresa(id) on delete restrict,
  estado_anterior public.pedido_estado not null,
  estado_nuevo public.pedido_estado not null,
  actor_id uuid not null,
  motivo text null,
  creado_en timestamptz not null default now(),

  constraint pedido_estado_evento_cambio_real_chk
    check (estado_anterior <> estado_nuevo),
  constraint pedido_estado_evento_motivo_bounded_chk
    check (motivo is null or length(motivo) between 1 and 500),
  constraint pedido_estado_evento_retry_uniq
    unique (pedido_id, estado_anterior, estado_nuevo)
);

create index pedido_estado_evento_pedido_creado_idx
  on public.pedido_estado_evento (pedido_id, creado_en, id);

create index pedido_estado_evento_empresa_creado_idx
  on public.pedido_estado_evento (empresa_id, creado_en desc, id);

alter table public.pedido_estado_evento enable row level security;

revoke all privileges on table public.pedido_estado_evento
  from public, anon, authenticated, service_role;

grant select on table public.pedido_estado_evento to service_role;

create or replace function public.pedido_estado_evento_prevent_mutation()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if tg_op = 'DELETE'
     and not exists (
       select 1
       from public.pedido p
       where p.id = old.pedido_id
     ) then
    return old;
  end if;

  raise exception using
    errcode = '55000',
    message = 'pedido_estado_evento_append_only';
end;
$function$;

revoke execute on function public.pedido_estado_evento_prevent_mutation()
  from public, anon, authenticated, service_role;

create trigger trg_pedido_estado_evento_append_only
before update or delete on public.pedido_estado_evento
for each row
execute function public.pedido_estado_evento_prevent_mutation();

create or replace function public.transicionar_pedido_operacional(
  p_pedido_id uuid,
  p_empresa_id uuid,
  p_expected_state public.pedido_estado,
  p_target_state public.pedido_estado,
  p_actor_id uuid,
  p_motivo text default null
)
returns table (
  ok boolean,
  codigo_resultado text,
  pedido_id uuid,
  estado_anterior public.pedido_estado,
  estado_final public.pedido_estado,
  evento_id uuid,
  idempotente boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
set row_security = off
as $function$
declare
  v_pedido public.pedido%rowtype;
  v_evento_id uuid;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if p_pedido_id is null
     or p_empresa_id is null
     or p_expected_state is null
     or p_target_state is null
     or p_actor_id is null then
    raise exception using
      errcode = '22004',
      message = 'order_transition_required_parameter_missing';
  end if;

  if v_motivo is not null and length(v_motivo) > 500 then
    raise exception using
      errcode = '22001',
      message = 'order_transition_reason_too_long';
  end if;

  select p.*
  into v_pedido
  from public.pedido p
  where p.id = p_pedido_id
  for update;

  if not found then
    return query select
      false,
      'pedido_no_encontrado'::text,
      p_pedido_id,
      null::public.pedido_estado,
      null::public.pedido_estado,
      null::uuid,
      false;
    return;
  end if;

  if v_pedido.empresa_id is distinct from p_empresa_id then
    return query select
      false,
      'empresa_no_coincide'::text,
      v_pedido.id,
      v_pedido.estado,
      v_pedido.estado,
      null::uuid,
      false;
    return;
  end if;

  if v_pedido.estado = p_target_state then
    select e.id
    into v_evento_id
    from public.pedido_estado_evento e
    where e.pedido_id = v_pedido.id
      and e.empresa_id = p_empresa_id
      and e.estado_anterior = p_expected_state
      and e.estado_nuevo = p_target_state;

    if found then
      return query select
        true,
        'retry_idempotente'::text,
        v_pedido.id,
        p_expected_state,
        v_pedido.estado,
        v_evento_id,
        true;
      return;
    end if;
  end if;

  if v_pedido.estado <> p_expected_state then
    return query select
      false,
      'expected_state_stale'::text,
      v_pedido.id,
      v_pedido.estado,
      v_pedido.estado,
      null::uuid,
      false;
    return;
  end if;

  if v_pedido.estado in (
    'bloqueado'::public.pedido_estado,
    'entregado'::public.pedido_estado,
    'cancelado'::public.pedido_estado
  ) then
    return query select
      false,
      'estado_terminal'::text,
      v_pedido.id,
      v_pedido.estado,
      v_pedido.estado,
      null::uuid,
      false;
    return;
  end if;

  if not (
    (v_pedido.estado = 'pagado'::public.pedido_estado
      and p_target_state = 'en_preparacion'::public.pedido_estado)
    or (v_pedido.estado = 'en_preparacion'::public.pedido_estado
      and p_target_state = 'enviado'::public.pedido_estado)
    or (v_pedido.estado = 'enviado'::public.pedido_estado
      and p_target_state = 'entregado'::public.pedido_estado)
    or (v_pedido.estado = 'pendiente_pago'::public.pedido_estado
      and p_target_state = 'cancelado'::public.pedido_estado)
  ) then
    return query select
      false,
      'transicion_no_permitida'::text,
      v_pedido.id,
      v_pedido.estado,
      v_pedido.estado,
      null::uuid,
      false;
    return;
  end if;

  if p_target_state = 'cancelado'::public.pedido_estado
     and exists (
       select 1
       from public.intento_pago ip
       where ip.pedido_id = v_pedido.id
         and ip.empresa_id = p_empresa_id
         and (
           ip.estado in (
             'iniciado'::public.intento_pago_estado,
             'aprobado'::public.intento_pago_estado
           )
           or ip.preference_creation_state in ('creating', 'ready', 'ambiguous')
           or ip.preference_id is not null
           or ip.preference_init_point is not null
         )
     ) then
    return query select
      false,
      'cancelacion_pago_en_vuelo'::text,
      v_pedido.id,
      v_pedido.estado,
      v_pedido.estado,
      null::uuid,
      false;
    return;
  end if;

  update public.pedido p
  set estado = p_target_state
  where p.id = v_pedido.id
    and p.empresa_id = p_empresa_id
    and p.estado = p_expected_state;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'order_transition_concurrent_update';
  end if;

  insert into public.pedido_estado_evento (
    pedido_id,
    empresa_id,
    estado_anterior,
    estado_nuevo,
    actor_id,
    motivo
  )
  values (
    v_pedido.id,
    p_empresa_id,
    p_expected_state,
    p_target_state,
    p_actor_id,
    v_motivo
  )
  returning id into v_evento_id;

  return query select
    true,
    'transicion_aplicada'::text,
    v_pedido.id,
    p_expected_state,
    p_target_state,
    v_evento_id,
    false;
end;
$function$;

revoke execute on function public.transicionar_pedido_operacional(
  uuid,
  uuid,
  public.pedido_estado,
  public.pedido_estado,
  uuid,
  text
) from public, anon, authenticated;

grant execute on function public.transicionar_pedido_operacional(
  uuid,
  uuid,
  public.pedido_estado,
  public.pedido_estado,
  uuid,
  text
) to service_role;

comment on table public.pedido_estado_evento is
  'Append-only audit log for sovereign operational order state transitions.';

comment on function public.transicionar_pedido_operacional(
  uuid,
  uuid,
  public.pedido_estado,
  public.pedido_estado,
  uuid,
  text
) is
  'Sovereign CAS state machine for paid fulfillment and safe pre-payment cancellation.';

commit;
