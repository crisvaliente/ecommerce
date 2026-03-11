create or replace function public.crear_pedido_con_items(
  p_usuario_id uuid,
  p_empresa_id uuid,
  p_direccion_envio_id uuid,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_pedido_id uuid;
  v_item jsonb;

  v_direccion public.direccion_usuario%rowtype;
  v_producto public.producto%rowtype;

  v_producto_id uuid;
  v_cantidad integer;

  v_total numeric(12,2) := 0;
  v_precio_unitario numeric(12,2);
  v_nombre_producto text;

  v_direccion_snapshot jsonb;
  v_expira_en timestamptz := now() + interval '1 hour';
begin
  -- parámetros obligatorios
  if p_usuario_id is null then
    raise exception using message = 'usuario_id_required';
  end if;

  if p_empresa_id is null then
    raise exception using message = 'empresa_id_required';
  end if;

  if p_direccion_envio_id is null then
    raise exception using message = 'direccion_envio_id_required';
  end if;

  if p_items is null then
    raise exception using message = 'items_required';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception using message = 'items_must_be_array';
  end if;

  if jsonb_array_length(p_items) = 0 then
    raise exception using message = 'pedido_sin_items';
  end if;

  -- validar dirección
  select *
  into v_direccion
  from public.direccion_usuario
  where id = p_direccion_envio_id;

  if not found then
    raise exception using message = 'direccion_no_existe';
  end if;

  if v_direccion.usuario_id <> p_usuario_id then
    raise exception using message = 'direccion_no_pertenece_al_usuario';
  end if;

  -- construir snapshot soberano
  v_direccion_snapshot := jsonb_build_object(
    'direccion', v_direccion.direccion,
    'ciudad', v_direccion.ciudad,
    'pais', v_direccion.pais,
    'codigo_postal', v_direccion.codigo_postal,
    'tipo_direccion', v_direccion.tipo_direccion
  );

  -- primera pasada: validar items y calcular total soberano
  for v_item in
    select *
    from jsonb_array_elements(p_items)
  loop
    if nullif(trim(v_item->>'producto_id'), '') is null then
      raise exception using message = 'producto_id_required';
    end if;

    if nullif(trim(v_item->>'cantidad'), '') is null then
      raise exception using message = 'cantidad_required';
    end if;

    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    if v_cantidad <= 0 then
      raise exception using message = 'cantidad_invalida';
    end if;

    select *
    into v_producto
    from public.producto
    where id = v_producto_id;

    if not found then
      raise exception using message = 'producto_no_existe';
    end if;

    if v_producto.empresa_id <> p_empresa_id then
      raise exception using message = 'producto_no_pertenece_a_empresa';
    end if;

    if v_producto.usa_variantes = true then
      raise exception using message = 'variantes_no_soportadas_en_v1';
    end if;

    v_precio_unitario := v_producto.precio::numeric(12,2);

    v_total := v_total + round(v_precio_unitario * v_cantidad, 2);
  end loop;

  v_total := round(v_total, 2);

  -- crear pedido soberano
  insert into public.pedido (
    usuario_id,
    empresa_id,
    direccion_envio_id,
    estado,
    total,
    direccion_envio_snapshot,
    expira_en
  )
  values (
    p_usuario_id,
    p_empresa_id,
    p_direccion_envio_id,
    'pendiente_pago',
    v_total,
    v_direccion_snapshot,
    v_expira_en
  )
  returning id into v_pedido_id;

  -- segunda pasada: insertar items con shape real
  for v_item in
    select *
    from jsonb_array_elements(p_items)
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;

    select *
    into v_producto
    from public.producto
    where id = v_producto_id;

    v_precio_unitario := v_producto.precio::numeric(12,2);
    v_nombre_producto := v_producto.nombre::text;

    insert into public.pedido_item (
      pedido_id,
      empresa_id,
      producto_id,
      variante_id,
      nombre_producto,
      talle,
      precio_unitario,
      cantidad
    )
    values (
      v_pedido_id,
      p_empresa_id,
      v_producto_id,
      null,
      v_nombre_producto,
      null,
      v_precio_unitario,
      v_cantidad
    );
  end loop;

  return v_pedido_id;
end;
$function$;