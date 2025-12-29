-- ============================================
-- Usuario: contrato de identidad + tenancy + roles
-- ============================================

-- 1) Quitar UNIQUE global de correo
alter table public.usuario
drop constraint if exists usuario_correo_key;

-- 2) Tenancy obligatorio
alter table public.usuario
alter column empresa_id set not null;

-- 3) Limpiar FKs duplicadas y dejar una FK fuerte
alter table public.usuario
drop constraint if exists fk_usuario_empresa;

alter table public.usuario
drop constraint if exists usuario_empresa_id_fkey;

alter table public.usuario
add constraint usuario_empresa_id_fkey
foreign key (empresa_id)
references public.empresa(id)
on delete cascade;

-- 4) UNIQUE por empresa + correo (case-insensitive)
create unique index if not exists ux_usuario_empresa_correo_ci
on public.usuario (empresa_id, lower(correo));

-- 5) CHECK de rol
alter table public.usuario
drop constraint if exists usuario_rol_check;

alter table public.usuario
add constraint usuario_rol_check
check (rol in ('admin', 'staff', 'cliente'));
