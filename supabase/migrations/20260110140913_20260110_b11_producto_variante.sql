-- B1.1: Variantes + stock por talle
-- Tabla additive: no rompe prod. Stock real vive en variantes; producto.stock queda como fallback.

BEGIN;

-- 1) Tabla
CREATE TABLE IF NOT EXISTS public.producto_variante (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),

  empresa_id uuid NOT NULL,
  producto_id uuid NOT NULL,

  talle text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,

  creado_en timestamp without time zone DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT chk_producto_variante_stock_nonneg CHECK (stock >= 0),

  -- FK empresa (mantiene coherencia con tu producto que ya FKea a empresa)
  CONSTRAINT fk_producto_variante_empresa
    FOREIGN KEY (empresa_id)
    REFERENCES public.empresa(id)
    ON DELETE CASCADE,

  -- FK compuesta: asegura tenancy fuerte (el producto referenciado es de la misma empresa)
  CONSTRAINT fk_producto_variante_producto_empresa
    FOREIGN KEY (empresa_id, producto_id)
    REFERENCES public.producto(empresa_id, id)
    ON DELETE CASCADE
);

-- 2) Índices de acceso (admin panel / listados)
CREATE INDEX IF NOT EXISTS ix_producto_variante_empresa_producto
  ON public.producto_variante (empresa_id, producto_id);

CREATE INDEX IF NOT EXISTS ix_producto_variante_empresa_producto_activo
  ON public.producto_variante (empresa_id, producto_id, activo);

-- Unique case-insensitive para talle por producto y empresa
CREATE UNIQUE INDEX IF NOT EXISTS ux_producto_variante_empresa_producto_talle_ci
  ON public.producto_variante (empresa_id, producto_id, lower(talle));

-- 3) Trigger updated_at (solo si existe la función; evita romper si cambia la firma)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_updated_at'
  ) THEN
    -- dropeo defensivo por si re-corrés migración en entornos
    EXECUTE 'DROP TRIGGER IF EXISTS trg_producto_variante_set_updated_at ON public.producto_variante';
    EXECUTE 'CREATE TRIGGER trg_producto_variante_set_updated_at
             BEFORE UPDATE ON public.producto_variante
             FOR EACH ROW
             EXECUTE FUNCTION public.set_updated_at()';
  END IF;
END $$;

-- Helper para mantener compatibilidad con policies existentes que usan uid()
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'uid'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE $sql$
      CREATE FUNCTION public.uid()
      RETURNS uuid
      LANGUAGE sql
      STABLE
      AS $body$
        SELECT auth.uid();
      $body$;
    $sql$;
  END IF;
END
$do$;

GRANT EXECUTE ON FUNCTION public.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION public.uid() TO anon;



-- 4) RLS (igual patrón que producto)
ALTER TABLE public.producto_variante ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producto_variante FORCE ROW LEVEL SECURITY;

-- SELECT
DROP POLICY IF EXISTS producto_variante_select_empresa ON public.producto_variante;
CREATE POLICY producto_variante_select_empresa
ON public.producto_variante
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario u
    WHERE u.supabase_uid = uid()
      AND u.empresa_id = producto_variante.empresa_id
  )
);

-- INSERT
DROP POLICY IF EXISTS producto_variante_insert_empresa ON public.producto_variante;
CREATE POLICY producto_variante_insert_empresa
ON public.producto_variante
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuario u
    WHERE u.supabase_uid = uid()
      AND u.empresa_id = producto_variante.empresa_id
  )
);

-- UPDATE
DROP POLICY IF EXISTS producto_variante_update_empresa ON public.producto_variante;
CREATE POLICY producto_variante_update_empresa
ON public.producto_variante
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario u
    WHERE u.supabase_uid = uid()
      AND u.empresa_id = producto_variante.empresa_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.usuario u
    WHERE u.supabase_uid = uid()
      AND u.empresa_id = producto_variante.empresa_id
  )
);

-- DELETE
DROP POLICY IF EXISTS producto_variante_delete_empresa ON public.producto_variante;
CREATE POLICY producto_variante_delete_empresa
ON public.producto_variante
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.usuario u
    WHERE u.supabase_uid = uid()
      AND u.empresa_id = producto_variante.empresa_id
  )
);

COMMIT;
