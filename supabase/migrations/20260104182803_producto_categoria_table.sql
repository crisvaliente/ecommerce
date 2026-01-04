CREATE TABLE IF NOT EXISTS public.producto_categoria (
  empresa_id   uuid NOT NULL,
  producto_id  uuid NOT NULL,
  categoria_id uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, producto_id, categoria_id),
  CONSTRAINT fk_pc_producto
    FOREIGN KEY (empresa_id, producto_id)
    REFERENCES public.producto (empresa_id, id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pc_categoria
    FOREIGN KEY (empresa_id, categoria_id)
    REFERENCES public.categoria (empresa_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_pc_empresa_producto
  ON public.producto_categoria (empresa_id, producto_id);

CREATE INDEX IF NOT EXISTS idx_pc_empresa_categoria
  ON public.producto_categoria (empresa_id, categoria_id);
