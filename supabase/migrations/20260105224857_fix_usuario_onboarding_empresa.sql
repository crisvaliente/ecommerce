-- 1. Permitir usuarios sin empresa durante onboarding
alter table public.usuario
  alter column empresa_id drop not null;

-- 2. Agregar flag de onboarding
alter table public.usuario
  add column if not exists onboarding boolean not null default true;

-- 3. Forzar empresa solo cuando termina onboarding (idempotente)
alter table public.usuario
  drop constraint if exists usuario_empresa_o_onboarding;

alter table public.usuario
  add constraint usuario_empresa_o_onboarding
  check (onboarding = true or empresa_id is not null);

-- 4. Limpiar FKs duplicadas (dejamos una sola)
alter table public.usuario
  drop constraint if exists fk_usuario_empresa;

alter table public.usuario
  drop constraint if exists usuario_empresa_id_fkey;

-- 5. Crear FK única y coherente
alter table public.usuario
  add constraint usuario_empresa_id_fkey
  foreign key (empresa_id)
  references public.empresa(id)
  on delete set null;
