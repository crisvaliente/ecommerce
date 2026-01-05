alter table public.usuario enable row level security;

drop policy if exists usuario_select_own on public.usuario;
create policy usuario_select_own
on public.usuario
for select
to authenticated
using (supabase_uid = auth.uid());

drop policy if exists usuario_update_own on public.usuario;
create policy usuario_update_own
on public.usuario
for update
to authenticated
using (supabase_uid = auth.uid())
with check (supabase_uid = auth.uid());
