-- B1.5 - Storage read policy for private bucket producto-imagenes
-- Enables signed URLs for authenticated users who can manage the product,
-- and only for objects registered in public.imagen_producto (url_imagen = objects.name).

drop policy if exists pi_read_public on storage.objects;

create policy "pi_select_member"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'producto-imagenes'
  and exists (
    select 1
    from public.imagen_producto ip
    where ip.url_imagen::text = objects.name
  )
  and can_manage_producto_member((split_part(objects.name, '/', 1))::uuid)
);
