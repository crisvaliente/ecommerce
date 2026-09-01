# Ecommerce

Next.js application backed by Supabase.

## Instance contract

Each deployment has one canonical storefront described by `instance.config.json`:

- `instanceKey`: stable technical namespace;
- `store.name`, `store.slug`, and optional `store.description`;
- `locale`;
- `currency`, currently restricted to `UYU`.

`src/config/instance.ts` validates that file and exposes the fixed storage contract:

```text
bucket: producto-imagenes
path: empresa/{empresaId}/producto/{productoId}/{imagenId}.{ext}
```

Secrets and deployment-specific URLs belong in `.env.local`, never in the JSON file. `APP_BASE_URL` is the canonical origin used for OAuth callbacks, trusted origins, and Mercado Pago webhook URLs.

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

   The command is idempotent, resolves the tenant by `store.slug`, links a real Supabase Auth user as `admin`, and verifies the private product image bucket. It never prints passwords.

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

## Bootstrap safety

- Run migrations before bootstrap.
- `SUPABASE_SERVICE_ROLE_KEY` is accepted only by local scripts and server-side code.
- An existing admin belonging to another tenant causes bootstrap to fail instead of being reassigned.
- Demo seeding and smoke-user bootstrap reject non-local Supabase URLs.
- Mercado Pago credentials are optional for admin/catalog and local order validation, but required before exercising checkout or webhooks.
- OAuth providers must allow `${APP_BASE_URL}/auth/callback` in the corresponding Supabase project.
