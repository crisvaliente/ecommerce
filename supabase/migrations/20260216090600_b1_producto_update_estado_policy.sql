create policy p_upd_estado_manage
on public.producto
for update
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto.empresa_id
  )
)
with check (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = producto.empresa_id
  )
);
