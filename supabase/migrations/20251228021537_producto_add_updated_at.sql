alter table producto
add column if not exists updated_at timestamptz not null default now();

update producto
set updated_at = now()
where updated_at is null;
