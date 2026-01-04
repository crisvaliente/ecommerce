DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ux_producto_empresa_id_id'
  ) THEN
    ALTER TABLE public.producto
      ADD CONSTRAINT ux_producto_empresa_id_id UNIQUE (empresa_id, id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ux_categoria_empresa_id_id'
  ) THEN
    ALTER TABLE public.categoria
      ADD CONSTRAINT ux_categoria_empresa_id_id UNIQUE (empresa_id, id);
  END IF;
END$$;
