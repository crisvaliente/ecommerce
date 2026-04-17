create table if not exists public.webhook_recepcion_mp (
  id uuid primary key default gen_random_uuid(),
  provider_event_id text null,
  x_request_id text not null,
  payment_id text not null,
  topic text null,
  action text null,
  signature_ts bigint not null,
  trace_id text not null,
  verification_mode text not null,
  estado text not null default 'recibido',
  detalle text null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  procesado_en timestamptz null,
  constraint chk_mp_webhook_recepcion_verification_mode
    check (verification_mode in ('signature')),
  constraint chk_mp_webhook_recepcion_estado
    check (estado in ('recibido', 'procesado', 'absorbido', 'error'))
);

create unique index if not exists ux_mp_webhook_recepcion_x_request_id
on public.webhook_recepcion_mp (x_request_id);

create unique index if not exists ux_mp_webhook_recepcion_provider_event_id
on public.webhook_recepcion_mp (provider_event_id)
where provider_event_id is not null;

create index if not exists idx_mp_webhook_recepcion_payment_id
on public.webhook_recepcion_mp (payment_id, creado_en desc);

create or replace function public.set_mp_webhook_recepcion_actualizado_en()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

drop trigger if exists trg_mp_webhook_recepcion_actualizado_en
on public.webhook_recepcion_mp;

create trigger trg_mp_webhook_recepcion_actualizado_en
before update on public.webhook_recepcion_mp
for each row
execute function public.set_mp_webhook_recepcion_actualizado_en();

alter table public.webhook_recepcion_mp enable row level security;

comment on table public.webhook_recepcion_mp
is 'Recepción de webhooks de Mercado Pago para anti-replay, deduplicación y auditoría operativa.';

comment on column public.webhook_recepcion_mp.x_request_id
is 'Identificador por entrega usado para deduplicar reintentos del proveedor.';

comment on column public.webhook_recepcion_mp.provider_event_id
is 'Identificador del evento/notificación del proveedor cuando viene informado.';
