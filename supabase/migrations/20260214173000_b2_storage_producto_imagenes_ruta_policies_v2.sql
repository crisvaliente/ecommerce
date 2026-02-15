begin;

drop policy if exists pi_insert_member on storage.objects;
create policy pi_insert_member
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'producto-imagenes'
  and split_part(name,'/',1) = 'empresa'
  and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name,'/',3) = 'producto'
  and split_part(name,'/',4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name,'/',5) <> ''
  and can_manage_producto_member((split_part(name,'/',4))::uuid)
);

drop policy if exists pi_delete_member on storage.objects;
create policy pi_delete_member
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'producto-imagenes'
  and split_part(name,'/',1) = 'empresa'
  and split_part(name,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name,'/',3) = 'producto'
  and split_part(name,'/',4) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and split_part(name,'/',5) <> ''
  and can_manage_producto_member((split_part(name,'/',4))::uuid)
);

drop policy if exists pi_read_public on storage.objects;
create policy pi_read_public
on storage.objects
for select
to public
using (
  bucket_id = 'producto-imagenes'
  and exists (
    select 1
    from public.imagen_producto ip
    where ip.path = storage.objects.name
      and ip.deleted_at is null
  )
);

commit;
