-- ======================================
-- Permisos y policy para tabla categoria
-- Fecha: 2025-11-28
-- ======================================

-- Otorgar permisos al rol authenticated
grant usage, select, insert, update, delete
on table categoria
to authenticated;

-- Policy temporal de desarrollo para permitir CRUD
create policy "categoria_all_true"
on categoria
for all
using (true)
with check (true);
