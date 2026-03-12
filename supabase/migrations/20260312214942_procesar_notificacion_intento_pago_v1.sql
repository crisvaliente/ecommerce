create or replace function public.procesar_notificacion_intento_pago(
  p_intento_pago_id uuid,
  p_estado_objetivo public.intento_pago_estado
)
returns table (
  ok boolean,
  codigo_resultado text,
  intento_pago_id uuid,
  pedido_id uuid,
  estado_anterior public.intento_pago_estado,
  estado_actual public.intento_pago_estado,
  consolidacion_ejecutada boolean,
  consolidacion_ok boolean,
  consolidacion_codigo text,
  pedido_estado_final public.pedido_estado,
  intento_pago_consolidado_id uuid
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_intento record;
  v_pedido_id uuid;
  v_pedido_estado public.pedido_estado;
  v_pedido_intento_pago_consolidado_id uuid;
  v_consolidacion_ok boolean;
  v_consolidacion_codigo text;
  v_rows_updated integer;
begin
  select
    ip.id,
    ip.pedido_id,
    ip.estado,
    ip.canal_pago
  into v_intento
  from public.intento_pago ip
  where ip.id = p_intento_pago_id
  for update;

  if not found then
    return query
    select
      false,
      'intento_no_encontrado',
      p_intento_pago_id,
      null::uuid,
      null::public.intento_pago_estado,
      null::public.intento_pago_estado,
      false,
      null::boolean,
      null::text,
      null::public.pedido_estado,
      null::uuid;
    return;
  end if;

  select
    p.id,
    p.estado,
    p.intento_pago_consolidado_id
  into
    v_pedido_id,
    v_pedido_estado,
    v_pedido_intento_pago_consolidado_id
  from public.pedido p
  where p.id = v_intento.pedido_id;

  if not found then
    raise exception
      'integridad_inesperada: pedido % inexistente para intento_pago %',
      v_intento.pedido_id,
      v_intento.id;
  end if;

  if p_estado_objetivo is null
     or p_estado_objetivo not in (
       'aprobado'::public.intento_pago_estado,
       'rechazado'::public.intento_pago_estado,
       'cancelado'::public.intento_pago_estado,
       'expirado'::public.intento_pago_estado
     ) then
    return query
    select
      false,
      'estado_objetivo_invalido',
      v_intento.id,
      v_pedido_id,
      v_intento.estado,
      v_intento.estado,
      false,
      null::boolean,
      null::text,
      v_pedido_estado,
      v_pedido_intento_pago_consolidado_id;
    return;
  end if;

  if v_intento.estado = p_estado_objetivo then
    return query
    select
      true,
      'sin_cambios_idempotente',
      v_intento.id,
      v_pedido_id,
      v_intento.estado,
      v_intento.estado,
      false,
      null::boolean,
      null::text,
      v_pedido_estado,
      v_pedido_intento_pago_consolidado_id;
    return;
  end if;

  if (
    v_intento.estado in (
      'aprobado'::public.intento_pago_estado,
      'rechazado'::public.intento_pago_estado,
      'cancelado'::public.intento_pago_estado,
      'expirado'::public.intento_pago_estado
    )
  ) then
    return query
    select
      false,
      'transicion_no_permitida',
      v_intento.id,
      v_pedido_id,
      v_intento.estado,
      v_intento.estado,
      false,
      null::boolean,
      null::text,
      v_pedido_estado,
      v_pedido_intento_pago_consolidado_id;
    return;
  end if;

  update public.intento_pago
  set estado = p_estado_objetivo
  where id = v_intento.id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> 1 then
    raise exception
      'integridad_inesperada: update de intento_pago % afectó % filas',
      v_intento.id,
      v_rows_updated;
  end if;

  if p_estado_objetivo = 'aprobado'::public.intento_pago_estado then
    select
      c.ok,
      c.codigo_resultado
    into
      v_consolidacion_ok,
      v_consolidacion_codigo
    from public.consolidar_pago_pedido(v_intento.id) as c;

    if not found then
      v_consolidacion_ok := false;
      v_consolidacion_codigo := 'consolidacion_sin_resultado';
    end if;

    select
      p.estado,
      p.intento_pago_consolidado_id
    into
      v_pedido_estado,
      v_pedido_intento_pago_consolidado_id
    from public.pedido p
    where p.id = v_pedido_id;

    if not found then
      raise exception
        'integridad_inesperada: pedido % desapareció tras consolidación de intento_pago %',
        v_pedido_id,
        v_intento.id;
    end if;

    return query
    select
      true,
      case
        when coalesce(v_consolidacion_ok, false)
          then 'intento_aprobado_y_consolidado'
        else 'intento_aprobado_sin_consolidar'
      end,
      v_intento.id,
      v_pedido_id,
      v_intento.estado,
      p_estado_objetivo,
      true,
      v_consolidacion_ok,
      v_consolidacion_codigo,
      v_pedido_estado,
      v_pedido_intento_pago_consolidado_id;

    return;
  end if;

  return query
  select
    true,
    'intento_actualizado',
    v_intento.id,
    v_pedido_id,
    v_intento.estado,
    p_estado_objetivo,
    false,
    null::boolean,
    null::text,
    v_pedido_estado,
    v_pedido_intento_pago_consolidado_id;

  return;
end;
$$;