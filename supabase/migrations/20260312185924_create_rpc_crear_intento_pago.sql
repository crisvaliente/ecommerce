create or replace function public.crear_intento_pago(
  p_usuario_id uuid,
  p_pedido_id uuid,
  p_canal_pago public.canal_pago_tipo
)
returns table (
  ok boolean,
  codigo_resultado text,
  intento_pago_id uuid,
  pedido_id uuid,
  estado_intento public.intento_pago_estado
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $function$
declare
  v_pedido_id uuid;
  v_empresa_id uuid;
  v_pedido_estado public.pedido_estado;
  v_expira_en timestamptz;
  v_bloqueado_por_stock boolean;
  v_intento_pago_consolidado_id uuid;
  v_intento_id uuid;
begin
  /*
    ============================================================
    BLOQUE 1 — Resolver pedido ownership-safe
    ============================================================
  */
  select
    p.id,
    p.empresa_id,
    p.estado,
    p.expira_en,
    p.bloqueado_por_stock,
    p.intento_pago_consolidado_id
  into
    v_pedido_id,
    v_empresa_id,
    v_pedido_estado,
    v_expira_en,
    v_bloqueado_por_stock,
    v_intento_pago_consolidado_id
  from public.pedido p
  where p.id = p_pedido_id
    and p.usuario_id = p_usuario_id
  for update;

  if not found then
    return query
    select
      false::boolean,
      'pedido_no_encontrado'::text,
      null::uuid,
      null::uuid,
      null::public.intento_pago_estado;
    return;
  end if;

  /*
    ============================================================
    BLOQUE 2 — Validar integridad y pagabilidad soberana
    ============================================================
  */
  if p_canal_pago is null then
    raise exception
      'integridad_inesperada: p_canal_pago null en crear_intento_pago para pedido %',
      p_pedido_id;
  end if;

  if v_empresa_id is null then
    raise exception
      'integridad_inesperada: pedido % sin empresa_id',
      v_pedido_id;
  end if;

  if v_expira_en is null then
    raise exception
      'integridad_inesperada: pedido % sin expira_en',
      v_pedido_id;
  end if;

  if v_expira_en <= now() then
    return query
    select
      false::boolean,
      'pedido_expirado'::text,
      null::uuid,
      v_pedido_id,
      null::public.intento_pago_estado;
    return;
  end if;

  if v_bloqueado_por_stock = true then
    return query
    select
      false::boolean,
      'pedido_bloqueado'::text,
      null::uuid,
      v_pedido_id,
      null::public.intento_pago_estado;
    return;
  end if;

  if v_pedido_estado <> 'pendiente_pago'::public.pedido_estado
     or v_intento_pago_consolidado_id is not null then
    return query
    select
      false::boolean,
      'pedido_no_pagable'::text,
      null::uuid,
      v_pedido_id,
      null::public.intento_pago_estado;
    return;
  end if;

  /*
    ============================================================
    BLOQUE 3 — Crear intento_pago
    ============================================================
  */
  insert into public.intento_pago (
    pedido_id,
    empresa_id,
    estado,
    canal_pago,
    external_id
  )
  values (
    v_pedido_id,
    v_empresa_id,
    'iniciado'::public.intento_pago_estado,
    p_canal_pago,
    null
  )
  returning id
  into v_intento_id;

  /*
    ============================================================
    BLOQUE 4 — Retorno soberano
    ============================================================
  */
  return query
  select
    true::boolean,
    'creado'::text,
    v_intento_id,
    v_pedido_id,
    'iniciado'::public.intento_pago_estado;
  return;
end;
$function$;