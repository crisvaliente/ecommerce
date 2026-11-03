# Ecommerce

Next.js application backed by Supabase.

## Instance contract

Each deployment has one canonical storefront described by `instance.config.json`:

- `instanceKey`: stable technical namespace;
- `store.name`, `store.slug`, and optional `store.description`;
- `store.assets.logo`, `store.assets.hero`, and `store.assets.favicon` as public asset paths;
- `locale`;
- `currency`, currently restricted to `UYU`.

`src/config/instance.ts` validates that file and exposes the fixed storage contract:

```text
bucket: producto-imagenes
path: empresa/{empresaId}/producto/{productoId}/{imagenId}.{ext}
```

Each instance must provide valid local files for its configured logo, hero, and favicon paths. Asset validation checks the paths, not the file contents.

Secrets and deployment-specific URLs belong in `.env.local`, never in the JSON file. `APP_BASE_URL` is the platform origin: it receives the Mercado Pago webhook and is the trusted origin for panel APIs. Buyer checkout, payment return URLs, and sign-up redirects use the domain of the store the buyer is on (see Gate 2 tenant domains).

## Local baseline

Use only credentials from the local Supabase stack. Never copy hosted credentials into the local environment.

1. Install the locked dependencies:

   ```bash
   pnpm install --frozen-lockfile
   ```

2. Review `instance.config.json`, then start Supabase locally:

   ```bash
   pnpm exec supabase start
   ```

3. Rebuild an empty local database from migrations:

   ```bash
   pnpm exec supabase db reset --local
   ```

   `supabase/seed.sql` is intentionally empty: a database reset no longer creates a smoke tenant or fixed fixture UUIDs.

4. Create the local environment file:

   ```bash
   cp local-env.sample .env.local
   pnpm exec supabase status -o env
   ```

   Map `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY` to the Supabase variables in `.env.local`. Set local-only credentials for the first admin and smoke users.

5. Bootstrap the configured tenant and first admin:

   ```bash
   pnpm bootstrap:instance
   ```

   The command is idempotent, resolves the tenant by `store.slug`, registers the normalized `APP_BASE_URL` hostname without reassigning collisions, links a real Supabase Auth user as `admin`, and verifies the private product image bucket. It never prints passwords.

6. Optionally create an idempotent demo catalog:

   ```bash
   pnpm seed:optional
   ```

7. Optionally bootstrap local smoke users against the configured tenant:

   ```bash
   pnpm smoke:bootstrap
   ```

8. Run static validation and build:

   ```bash
   pnpm test:instance-config
   pnpm lint
   pnpm build
   ```

To run the development server afterward:

```bash
pnpm dev
```

Open the URL configured in `APP_BASE_URL`.

## Gate 2 tenant domains

Public collection reads select a company only from the direct Node/Next `Host` header and an exact row in the private `public.empresa_dominio` registry. Query/body/cookie values, `Origin`, `Referer`, `X-Forwarded-Host`, `empresa.slug`, aliases, and localhost are never fallbacks. Buyer write APIs (`POST /api/ecommerce/pedido`, `POST /api/ecommerce/intento-pago`, `PUT /api/ecommerce/mi-cuenta/direccion`) resolve their store the same way: an unknown domain answers `404 tienda_no_encontrada`, a registry failure `503 tienda_no_disponible`, and only an `Origin`/`Referer` of that same store is trusted. Orders use the store of the domain (a different body `empresa_id` answers `400 empresa_no_coincide_con_dominio`), Mercado Pago `back_urls` return to that domain, and sign-up confirmation and Google sign-in return to `<current origin>/auth/callback`. Branding, locale, currency, auth namespace, and the Mercado Pago webhook URL remain instance-wide.

Roll out in this order:

1. Apply migrations and run `pnpm test:storefront-tenant:db`.
2. Run `pnpm bootstrap:instance`; it registers the normalized `APP_BASE_URL` hostname with a plain collision-safe insert. Register every production, local, preview, alias, and health-check hostname intended to serve the storefront explicitly.
3. Verify through trusted SQL that each hostname has the intended owner and that anon/authenticated roles cannot enumerate the registry.
4. Prove on the actual hosting path that the requested custom domain is preserved as exactly one direct Node/Next `Host`. Do not deploy this v1 if only `X-Forwarded-Host` preserves it.
5. Deploy runtime code, then smoke two mapped hosts, an unknown host (404), conflicting query/forwarding inputs (no tenant change), and an induced registry failure (503 with `Cache-Control: no-store`).

Local two-host probes should avoid wildcard-DNS assumptions:

```bash
curl --resolve tenant-a.localhost:3000:127.0.0.1 -sS -D /tmp/tenant-a.headers \
  -o /tmp/tenant-a.html http://tenant-a.localhost:3000/coleccion
curl --resolve tenant-b.localhost:3000:127.0.0.1 -sS -D /tmp/tenant-b.headers \
  -o /tmp/tenant-b.html http://tenant-b.localhost:3000/coleccion
```

Invalid and unknown hosts intentionally return the generic 404. Registry infrastructure failures return a generic unavailable storefront and log only `[storefront-tenant] lookup_failed` plus the safe normalized hostname. If rollout locks out a valid host, correct its mapping or revert the runtime integration first. Retain the additive registry and Gate 1 isolation for diagnosis; never introduce a slug fallback or reassign a collision with upsert.

## Bootstrap safety

- Run migrations before bootstrap.
- `SUPABASE_SERVICE_ROLE_KEY` is accepted only by local scripts and server-side code.
- An existing admin belonging to another tenant causes bootstrap to fail instead of being reassigned.
- Demo seeding and smoke-user bootstrap reject non-local Supabase URLs.
- Mercado Pago credentials are optional for admin/catalog and local order validation, but required before exercising checkout or webhooks.
- Supabase Auth must allow `https://<store domain>/auth/callback` for every store domain (and `${APP_BASE_URL}/auth/callback` locally) in its redirect URLs.

## Mercado Pago credentials (operator)

Gate 6 (`odd/tasks/mercadopago-per-store.md`) stores each store's Mercado Pago access token and webhook secret sealed with the platform's public key in `public.empresa_mercadopago`; the private key never leaves Vercel Production, so the operator's machine, the database, and a dump can never decrypt them. G6-1 ships the schema, the sealing module, and this command; checkout and webhooks keep using the env credentials until G6-2/G6-3.

`keygen` generates a key pair once per `key_version`, outside the repository:

```bash
pnpm mp:credentials keygen --out-dir /path/outside/the/repo --key-version 1
```

Prints the public and private PEM paths (modes `0644`/`0600`). Keep the public key in the repository or the runbook; the private key goes only to Vercel Production as `MP_CREDENTIALS_PRIVATE_KEY_V<n>` (one env var per `key_version`, e.g. `MP_CREDENTIALS_PRIVATE_KEY_V1`).

`set` loads one store's credentials, reading the token and the webhook secret from stdin (never as flags or environment variables):

```bash
printf '%s\n%s\n' "$ACCESS_TOKEN" "$WEBHOOK_SECRET" | pnpm mp:credentials set \
  --empresa <empresa-uuid> --mode live --key-version 1 \
  --public-key-file /path/outside/the/repo/mercadopago-credentials-v1.public.pem \
  --target local
```

Use `--target linked --project-ref <ref>` for a linked project (not authorized for production in this gate). The command verifies the token against `GET /users/me` (Uruguay site, `MLU`), seals both values, and writes one row through the SQL runner; it never accepts a credential already configured for the store (`credenciales_ya_configuradas`) or a Mercado Pago account already attached to another store (`cuenta_ya_asociada`). Success prints only the company id, `mp_user_id`, `live_mode`, `key_version`, and the webhook path to configure in that store's Mercado Pago application.

G6-2 rollout order: apply the migration → `keygen` → put the private key in Vercel Production as `MP_CREDENTIALS_PRIVATE_KEY_V<n>` → load each store's credentials with `set` → deploy G6-2. From then on, `POST /api/ecommerce/intento-pago` reads only the requesting store's row in `public.empresa_mercadopago`: a store without active credentials gets `409 pagos_no_configurados` before any payment attempt is created, and a store whose row cannot be decrypted (missing key, wrong `key_version`, tampered ciphertext) gets `503 pagos_no_disponibles`. `MERCADOPAGO_ACCESS_TOKEN` is no longer read by preference creation; `GET /api/panel/pagos` (capability `payments.access`) exposes only `{ configurado, live_mode, estado }` for the caller's own company.
