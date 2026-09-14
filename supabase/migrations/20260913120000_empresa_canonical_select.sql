begin;

-- Replace every legacy company read path with the canonical usuario tenancy link.
drop policy if exists select_empresa_authenticated on public.empresa;
drop policy if exists empresa_sel_own on public.empresa;
drop policy if exists empresa_select_members on public.empresa;
drop policy if exists empresa_select_canonical_tenant on public.empresa;

create policy empresa_select_canonical_tenant
on public.empresa
for select
to authenticated
using (
  exists (
    select 1
    from public.usuario u
    where u.supabase_uid = auth.uid()
      and u.empresa_id = empresa.id
  )
);

commit;
