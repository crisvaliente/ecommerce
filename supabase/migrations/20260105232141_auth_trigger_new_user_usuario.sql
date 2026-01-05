-- Asegurar función (la dejamos igual, pero agregamos empresa_id/onboarding/updated_at si existen)
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_nombre text;
begin
  v_nombre := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1),
    'Usuario'
  );

  begin
    insert into public.usuario (
      id, supabase_uid, correo, nombre, rol, fecha_registro,
      empresa_id, onboarding, updated_at
    )
    values (
      new.id, new.id, new.email, v_nombre, 'cliente', now(),
      null, true, now()
    );

  exception
    when unique_violation then
      update public.usuario
         set id = new.id,
             supabase_uid = new.id,
             nombre = coalesce(public.usuario.nombre, v_nombre),
             rol = coalesce(public.usuario.rol, 'cliente'),
             updated_at = now()
       where correo = new.email;
  end;

  return new;
end;
$$;

-- Trigger en auth.users (idempotente)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();
