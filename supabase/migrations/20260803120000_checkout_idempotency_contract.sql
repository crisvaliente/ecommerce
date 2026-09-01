begin;

create table public.checkout_pedido_idempotencia (
  usuario_id uuid not null references public.usuario(id) on delete cascade,
  idempotency_key uuid not null,
  request_fingerprint text not null
    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  pedido_id uuid not null references public.pedido(id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (usuario_id, idempotency_key),
  unique (pedido_id)
);

alter table public.checkout_pedido_idempotencia enable row level security;

revoke all privileges on table public.checkout_pedido_idempotencia
  from public, anon, authenticated;

alter table public.intento_pago
  add column preference_init_point text null,
  add column preference_creation_state text null,
  add column preference_creation_started_at timestamptz null,
  add column preference_last_error text null;

update public.intento_pago
set preference_creation_state = case
  when preference_id is not null and preference_init_point is not null then 'ready'
  when preference_id is not null then 'ambiguous'
  else 'not_started'
end;

alter table public.intento_pago
  alter column preference_creation_state set default 'not_started',
  alter column preference_creation_state set not null,
  add constraint intento_pago_preference_init_point_requires_id_chk
    check (preference_init_point is null or preference_id is not null),
  add constraint intento_pago_preference_creation_state_chk
    check (preference_creation_state in (
      'not_started',
      'creating',
      'ready',
      'ambiguous',
      'failed'
    )),
  add constraint intento_pago_preference_ready_requires_data_chk
    check (
      preference_creation_state <> 'ready'
      or (preference_id is not null and preference_init_point is not null)
    ),
  add constraint intento_pago_preference_creating_requires_timestamp_chk
    check (
      preference_creation_state <> 'creating'
      or preference_creation_started_at is not null
    ),
  add constraint intento_pago_preference_last_error_length_chk
    check (preference_last_error is null or length(preference_last_error) <= 100);

do $$
begin
  if exists (
    select 1
    from public.intento_pago
    where preference_id is not null
    group by preference_id
    having count(*) > 1
  ) then
    raise exception 'checkout_idempotency: duplicate intento_pago.preference_id values must be resolved first';
  end if;
end
$$;

create unique index ux_intento_pago_preference_id
  on public.intento_pago (preference_id)
  where preference_id is not null;

create or replace function public.crear_pedido_con_items_idempotente(
  p_usuario_id uuid,
  p_empresa_id uuid,
  p_direccion_envio_id uuid,
  p_items jsonb,
  p_idempotency_key uuid,
  p_request_fingerprint text
)
returns table (
  pedido_id uuid,
  reutilizado boolean
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_existing public.checkout_pedido_idempotencia%rowtype;
  v_pedido_id uuid;
begin
  if p_idempotency_key is null then
    raise exception using message = 'idempotency_key_required';
  end if;

  if p_request_fingerprint is null
     or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    raise exception using message = 'request_fingerprint_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_usuario_id::text || ':' || p_idempotency_key::text,
      0
    )
  );

  select c.*
  into v_existing
  from public.checkout_pedido_idempotencia c
  where c.usuario_id = p_usuario_id
    and c.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using message = 'idempotency_key_reused';
    end if;

    return query select v_existing.pedido_id, true;
    return;
  end if;

  v_pedido_id := public.crear_pedido_con_items(
    p_usuario_id,
    p_empresa_id,
    p_direccion_envio_id,
    p_items
  );

  insert into public.checkout_pedido_idempotencia (
    usuario_id,
    idempotency_key,
    request_fingerprint,
    pedido_id
  )
  values (
    p_usuario_id,
    p_idempotency_key,
    p_request_fingerprint,
    v_pedido_id
  );

  return query select v_pedido_id, false;
end;
$function$;

revoke execute on function public.crear_pedido_con_items_idempotente(
  uuid, uuid, uuid, jsonb, uuid, text
) from public, anon, authenticated;

grant execute on function public.crear_pedido_con_items_idempotente(
  uuid, uuid, uuid, jsonb, uuid, text
) to service_role;

comment on table public.checkout_pedido_idempotencia is
  'Server-only mapping from a buyer checkout idempotency key to its committed pedido.';
comment on column public.intento_pago.preference_init_point is
  'Checkout URL returned for the persisted Mercado Pago preference. Reused on retries.';
comment on column public.intento_pago.preference_creation_state is
  'Fail-closed bridge state for preference dispatch/reconciliation; separate from intento_pago.estado.';
comment on column public.intento_pago.preference_creation_started_at is
  'Timestamp of the only automatic POST claim. A stale claim is reconciled and never reset automatically.';
comment on column public.intento_pago.preference_last_error is
  'Bounded diagnostic code only; provider payloads and secrets are never stored here.';
comment on function public.crear_pedido_con_items_idempotente(
  uuid, uuid, uuid, jsonb, uuid, text
) is 'Serializes a checkout key, replays the original pedido for the same request fingerprint, and delegates first creation to crear_pedido_con_items.';

commit;
