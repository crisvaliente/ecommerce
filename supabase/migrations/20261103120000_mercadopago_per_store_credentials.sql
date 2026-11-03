begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- Gate 6, G6-1: one Mercado Pago account per store. The table holds only
-- sealed ciphertexts (public-key sealing, see src/lib/mercadoPagoCredentials.ts);
-- it is unreachable from anon/authenticated and read-only for service_role.
-- Writes happen through the operator command as the postgres role, which
-- bypasses RLS. This migration is additive: it does not touch existing
-- preference, webhook or checkout behavior (G6-2/G6-3 wire the new columns).
create table public.empresa_mercadopago (
  empresa_id uuid primary key references public.empresa (id) on delete restrict,
  mp_user_id bigint not null check (mp_user_id > 0),
  live_mode boolean not null,
  webhook_key text not null unique check (webhook_key ~ '^[A-Za-z0-9_-]{43}$'),
  access_token_enc text not null check (access_token_enc like 'v1:%'),
  webhook_secret_enc text not null check (webhook_secret_enc like 'v1:%'),
  previous_webhook_secret_enc text check (previous_webhook_secret_enc like 'v1:%'),
  previous_secret_valid_until timestamptz,
  key_version smallint not null check (key_version > 0),
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  rotado_en timestamptz,
  constraint empresa_mercadopago_mp_user_id_live_mode_key unique (mp_user_id, live_mode),
  constraint empresa_mercadopago_previous_secret_pair check (
    (previous_webhook_secret_enc is null) = (previous_secret_valid_until is null)
  )
);

alter table public.empresa_mercadopago enable row level security;
alter table public.empresa_mercadopago force row level security;

revoke all on table public.empresa_mercadopago from public, anon, authenticated, service_role;
grant select on table public.empresa_mercadopago to service_role;

-- Stamped when a preference is created, so recover/reconcile/webhook can
-- require it to still equal the store's current mp_user_id (G6-2/G6-3).
alter table public.intento_pago
  add column mp_user_id bigint;
alter table public.intento_pago
  add constraint intento_pago_mp_user_id_check check (mp_user_id is null or mp_user_id > 0);

-- Filled by the per-store webhook route, so every receipt is attributable
-- to a store even when the account (mp_user_id) later rotates.
alter table public.webhook_recepcion_mp
  add column empresa_id uuid references public.empresa (id) on delete restrict;

commit;
