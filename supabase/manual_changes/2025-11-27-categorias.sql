-----------------------------------------------
-- Cambios para módulo de categorías
-- Fecha: 2025-11-27
-----------------------------------------------

-- Asegurar columnas esenciales en categoria
alter table categoria
  add column if not exists slug text,
  add column if not exists descripcion text,
  add column if not exists orden integer default 0,
  add column if not exists parent_id uuid references categoria(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Relación producto -> categoria
alter table producto
  add column if not exists categoria_id uuid references categoria(id) on delete set null;

-- RLS (si falta, sino queda documentado igual)
alter table categoria enable row level security;
