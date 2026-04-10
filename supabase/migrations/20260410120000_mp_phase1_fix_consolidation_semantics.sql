-- =========================================================
-- Mercado Pago — Fase 1
-- Corrige semántica de consolidación para evitar falsos
-- positivos de éxito cuando el pedido no quedó pagado.
-- =========================================================

create or replace function public.consolidar_pago_pedido(
  p_intento_pago_id uuid
)
returns table (
  ok boolean,
  codigo_resultado text,
  pedido_id uuid,
  estado_final pedido_estado,
  intento_pago_consolidado_id uuid
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  -- intento
  v_intento_id uuid;
  v_pedido_id uuid;
  v_empresa_id uuid;
  v_intento_estado intento_pago_estado;

  -- pedido
  v_pedido_estado pedido_estado;
  v_pedido_empresa_id uuid;
  v_pedido_expira_en timestamptz;
  v_pedido_intento_pago_consolidado_id uuid;

  -- control general
  v_rows_updated bigint;
  v_falta_stock boolean;

  -- control sets / locking
  v_simple_count bigint;
  v_variante_count bigint;
  v_simple_locked_count bigint;
  v_variante_locked_count bigint;
begin
  select
    ip.id,
    ip.pedido_id,
    ip.empresa_id,
    ip.estado
  into
    v_intento_id,
    v_pedido_id,
    v_empresa_id,
    v_intento_estado
  from public.intento_pago ip
  where ip.id = p_intento_pago_id;

  if not found then
    return query
    select
      false::boolean,
      'intento_no_existe'::text,
      null::uuid,
      null::pedido_estado,
      null::uuid;
    return;
  end if;

  if v_intento_estado <> 'aprobado'::intento_pago_estado then
    return query
    select
      false::boolean,
      'intento_no_aprobado'::text,
      v_pedido_id,
      null::pedido_estado,
      null::uuid;
    return;
  end if;

  select
    p.estado,
    p.empresa_id,
    p.expira_en,
    p.intento_pago_consolidado_id
  into
    v_pedido_estado,
    v_pedido_empresa_id,
    v_pedido_expira_en,
    v_pedido_intento_pago_consolidado_id
  from public.pedido p
  where p.id = v_pedido_id
  for update;

  if not found then
    raise exception
      'integridad_inesperada: pedido % inexistente para intento_pago %',
      v_pedido_id,
      v_intento_id;
  end if;

  if v_pedido_empresa_id <> v_empresa_id then
    return query
    select
      false::boolean,
      'intento_pedido_inconsistente'::text,
      v_pedido_id,
      v_pedido_estado,
      null::uuid;
    return;
  end if;

  if v_pedido_intento_pago_consolidado_id is not null
     and v_pedido_estado <> 'pagado'::pedido_estado then
    raise exception
      'integridad_inesperada: pedido % tiene intento consolidado % pero estado=%',
      v_pedido_id,
      v_pedido_intento_pago_consolidado_id,
      v_pedido_estado;
  end if;

  if v_pedido_intento_pago_consolidado_id is not null then
    if v_pedido_intento_pago_consolidado_id = p_intento_pago_id then
      return query
      select
        true::boolean,
        'idempotente'::text,
        v_pedido_id,
        v_pedido_estado,
        v_pedido_intento_pago_consolidado_id;
      return;
    end if;

    return query
    select
      false::boolean,
      'pedido_ya_consolidado_por_otro_intento'::text,
      v_pedido_id,
      v_pedido_estado,
      v_pedido_intento_pago_consolidado_id;
    return;
  end if;

  if v_pedido_estado <> 'pendiente_pago'::pedido_estado then
    return query
    select
      false::boolean,
      'pedido_no_consolidable'::text,
      v_pedido_id,
      v_pedido_estado,
      null::uuid;
    return;
  end if;

  if v_pedido_expira_en is null then
    raise exception
      'integridad_inesperada: pedido % sin expira_en',
      v_pedido_id;
  end if;

  if now() > v_pedido_expira_en then
    return query
    select
      false::boolean,
      'pedido_expirado'::text,
      v_pedido_id,
      v_pedido_estado,
      null::uuid;
    return;
  end if;

  if not exists (
    select 1
    from public.pedido_item pi
    where pi.pedido_id = v_pedido_id
  ) then
    raise exception
      'integridad_inesperada: pedido % no tiene items',
      v_pedido_id;
  end if;

  if exists (
    select 1
    from public.pedido_item pi
    where pi.pedido_id = v_pedido_id
      and pi.producto_id is null
  ) then
    raise exception
      'integridad_inesperada: pedido % tiene items sin producto_id',
      v_pedido_id;
  end if;

  if exists (
    select 1
    from public.pedido_item pi
    where pi.pedido_id = v_pedido_id
      and pi.cantidad <= 0
  ) then
    raise exception
      'integridad_inesperada: pedido % tiene items con cantidad <= 0',
      v_pedido_id;
  end if;

  create temporary table if not exists pg_temp.tmp_stock_simple_requerido (
    producto_id uuid primary key,
    cantidad_requerida integer not null
  ) on commit drop;

  truncate pg_temp.tmp_stock_simple_requerido;

  create temporary table if not exists pg_temp.tmp_stock_variante_requerido (
    producto_variante_id uuid primary key,
    producto_id uuid not null,
    cantidad_requerida integer not null
  ) on commit drop;

  truncate pg_temp.tmp_stock_variante_requerido;

  if exists (
    select 1
    from public.pedido_item pi
    join public.producto pr
      on pr.id = pi.producto_id
    left join public.producto_variante pv
      on pv.id = pi.variante_id
    where pi.pedido_id = v_pedido_id
      and pr.usa_variantes = true
      and (
        pi.variante_id is null
        or pv.id is null
        or pv.producto_id <> pi.producto_id
        or pv.empresa_id <> v_empresa_id
      )
  ) then
    raise exception
      'integridad_inesperada: pedido % tiene items con variante inválida o inconsistente',
      v_pedido_id;
  end if;

  if exists (
    select 1
    from public.pedido_item pi
    join public.producto pr
      on pr.id = pi.producto_id
    where pi.pedido_id = v_pedido_id
      and pr.usa_variantes = false
      and pi.variante_id is not null
  ) then
    raise exception
      'integridad_inesperada: pedido % tiene items simples con variante_id informado',
      v_pedido_id;
  end if;

  insert into pg_temp.tmp_stock_simple_requerido (
    producto_id,
    cantidad_requerida
  )
  select
    pi.producto_id,
    sum(pi.cantidad)::integer
  from public.pedido_item pi
  join public.producto pr
    on pr.id = pi.producto_id
  where pi.pedido_id = v_pedido_id
    and pr.usa_variantes = false
  group by pi.producto_id;

  insert into pg_temp.tmp_stock_variante_requerido (
    producto_variante_id,
    producto_id,
    cantidad_requerida
  )
  select
    pv.id as producto_variante_id,
    pv.producto_id,
    sum(pi.cantidad)::integer
  from public.pedido_item pi
  join public.producto pr
    on pr.id = pi.producto_id
  join public.producto_variante pv
    on pv.id = pi.variante_id
   and pv.producto_id = pi.producto_id
   and pv.empresa_id = v_empresa_id
  where pi.pedido_id = v_pedido_id
    and pr.usa_variantes = true
  group by pv.id, pv.producto_id;

  if not exists (select 1 from pg_temp.tmp_stock_simple_requerido)
     and not exists (select 1 from pg_temp.tmp_stock_variante_requerido) then
    raise exception
      'integridad_inesperada: pedido % no produjo fuentes válidas de stock',
      v_pedido_id;
  end if;

  select count(*)
  into v_simple_count
  from pg_temp.tmp_stock_simple_requerido;

  select count(*)
  into v_variante_count
  from pg_temp.tmp_stock_variante_requerido;

  select count(*)
  into v_simple_locked_count
  from (
    select p.id
    from public.producto p
    join pg_temp.tmp_stock_simple_requerido req
      on req.producto_id = p.id
    order by p.id
    for update
  ) s;

  if v_simple_locked_count <> v_simple_count then
    raise exception
      'integridad_inesperada: lock de producto en pedido % esperaba % filas y bloqueó %',
      v_pedido_id,
      v_simple_count,
      v_simple_locked_count;
  end if;

  select count(*)
  into v_variante_locked_count
  from (
    select pv.id
    from public.producto_variante pv
    join pg_temp.tmp_stock_variante_requerido req
      on req.producto_variante_id = pv.id
    order by pv.id
    for update
  ) s;

  if v_variante_locked_count <> v_variante_count then
    raise exception
      'integridad_inesperada: lock de producto_variante en pedido % esperaba % filas y bloqueó %',
      v_pedido_id,
      v_variante_count,
      v_variante_locked_count;
  end if;

  select
    (
      exists (
        select 1
        from public.producto p
        join pg_temp.tmp_stock_simple_requerido req
          on req.producto_id = p.id
        where p.stock < req.cantidad_requerida
      )
      or
      exists (
        select 1
        from public.producto_variante pv
        join pg_temp.tmp_stock_variante_requerido req
          on req.producto_variante_id = pv.id
        where pv.stock < req.cantidad_requerida
      )
    )
  into v_falta_stock;

  if v_falta_stock then
    update public.pedido p
    set
      estado = 'bloqueado'::pedido_estado,
      bloqueado_por_stock = true,
      intento_pago_consolidado_id = null
    where p.id = v_pedido_id;

    get diagnostics v_rows_updated = row_count;

    if v_rows_updated <> 1 then
      raise exception
        'integridad_inesperada: update bloqueo pedido % afectó % filas',
        v_pedido_id,
        v_rows_updated;
    end if;

    return query
    select
      false::boolean,
      'bloqueado_sin_stock'::text,
      v_pedido_id,
      'bloqueado'::pedido_estado,
      null::uuid;
    return;
  end if;

  update public.producto p
  set stock = p.stock - req.cantidad_requerida
  from pg_temp.tmp_stock_simple_requerido req
  where p.id = req.producto_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> v_simple_count then
    raise exception
      'integridad_inesperada: update stock simple en pedido % esperaba % filas y afectó %',
      v_pedido_id,
      v_simple_count,
      v_rows_updated;
  end if;

  if exists (
    select 1
    from public.producto p
    join pg_temp.tmp_stock_simple_requerido req
      on req.producto_id = p.id
    where p.stock < 0
  ) then
    raise exception
      'integridad_inesperada: stock simple negativo post-descuento en pedido %',
      v_pedido_id;
  end if;

  update public.producto_variante pv
  set stock = pv.stock - req.cantidad_requerida
  from pg_temp.tmp_stock_variante_requerido req
  where pv.id = req.producto_variante_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> v_variante_count then
    raise exception
      'integridad_inesperada: update stock variante en pedido % esperaba % filas y afectó %',
      v_pedido_id,
      v_variante_count,
      v_rows_updated;
  end if;

  if exists (
    select 1
    from public.producto_variante pv
    join pg_temp.tmp_stock_variante_requerido req
      on req.producto_variante_id = pv.id
    where pv.stock < 0
  ) then
    raise exception
      'integridad_inesperada: stock variante negativo post-descuento en pedido %',
      v_pedido_id;
  end if;

  update public.pedido p
  set
    estado = 'pagado'::pedido_estado,
    intento_pago_consolidado_id = p_intento_pago_id,
    bloqueado_por_stock = false
  where p.id = v_pedido_id;

  get diagnostics v_rows_updated = row_count;

  if v_rows_updated <> 1 then
    raise exception
      'integridad_inesperada: update pago pedido % afectó % filas',
      v_pedido_id,
      v_rows_updated;
  end if;

  return query
  select
    true::boolean,
    'consolidado'::text,
    v_pedido_id,
    'pagado'::pedido_estado,
    p_intento_pago_id;
  return;
end;
$$;

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
      case
        when coalesce(v_consolidacion_ok, false)
             and v_consolidacion_codigo in ('consolidado', 'idempotente')
          then true
        else false
      end,
      case
        when coalesce(v_consolidacion_ok, false)
             and v_consolidacion_codigo in ('consolidado', 'idempotente')
          then 'intento_aprobado_y_consolidado'
        else 'intento_aprobado_no_consolidado'
      end,
      v_intento.id,
      v_pedido_id,
      v_intento.estado,
      p_estado_objetivo,
      true,
      coalesce(v_consolidacion_ok, false)
        and v_consolidacion_codigo in ('consolidado', 'idempotente'),
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
