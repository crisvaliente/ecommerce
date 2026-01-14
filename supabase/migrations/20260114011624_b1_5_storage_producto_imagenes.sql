begin;

-- 1) Crear bucket (si no existe)
insert into storage.buckets (id, name, public)
values ('producto-imagenes', 'producto-imagenes', false)
on conflict (id) do nothing;

-- 2) Helper inline: validar que el primer segmento del path sea UUID antes de castear
-- (lo usamos repetido en policies para evitar errores por cast)
-- Nota: no creamos función nueva para esto para mantenerlo simple y portable.

-- 3) SELECT (public): permitir lectura solo si existe registro en imagen_producto
-- (así no se “adivinan” paths, y la DB manda)
drop policy if exists "pi_read_public" on storage.objects;
create policy "pi_read_public"
on storage.objects
for select
to public
using (
  bucket_id = 'producto-imagenes'
  and exists (
    select 1
    from public.imagen_producto ip
    where ip.path = storage.objects.name
  )
);

-- 4) INSERT (authenticated): permitir subir solo si el path empieza con producto_id
-- y el usuario es miembro de la empresa del producto
drop policy if exists "pi_insert_member" on storage.objects;
create policy "pi_insert_member"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'producto-imagenes'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_manage_producto_member( (split_part(name, '/', 1))::uuid )
);

-- 5) DELETE (authenticated): permitir borrar solo si el objeto pertenece a un producto
-- que el usuario puede gestionar por membership
drop policy if exists "pi_delete_member" on storage.objects;
create policy "pi_delete_member"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'producto-imagenes'
  and split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_manage_producto_member( (split_part(name, '/', 1))::uuid )
);

-- 6) UPDATE: normalmente no es necesario (se renombra subiendo otro y borrando),
-- pero lo dejamos bloqueado por omisión (no creamos policy).

commit;
