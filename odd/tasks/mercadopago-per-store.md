# Gate 6 — Mercado Pago per store (DESIGN ONLY, implementation not authorized)

Each store charges with its own Mercado Pago account: its own credentials, encrypted at rest; preferences created with its token; one webhook route per store that verifies, fetches and updates only that store's payments. Decision record: `docs/architecture/decisiones/0003-mercadopago-credenciales-por-comercio.md`.
Status 2026-11-02: documentation and design only. No code, infrastructure or production change. Implementation (and the platform-domain gate P1) need separate authorization.

## Specs

User statements (2026-11-02), verbatim:

> "Autorizo el merge del PR #50, adoptar D1 (credenciales cifradas por comercio) como decisión arquitectónica y preparar Gate 6 exclusivamente como documentación y diseño."
> "Priorizamos el lanzamiento de FG Herramientas, garantizando aislamiento de credenciales, pagos y webhooks entre comercios."
> "Dejá definidos los controles de seguridad, migración de Raeyz, pagos en curso y pruebas sandbox."

- **S1 — "aislamiento de credenciales".** A store's Mercado Pago access token and webhook secret are stored encrypted, readable in clear only by the production server, never logged, never sent to the browser, never present in previews, development or backups.
- **S2 — "aislamiento … de pagos".** A preference is always created with the token of the store resolved from the request domain (Gate 5). A store without active credentials cannot start a payment. A payment can only update a payment attempt of the store whose account received it.
- **S3 — "aislamiento … de webhooks".** Each store has its own webhook route. A notification is verified with that store's secret and the payment is fetched with that store's token; a notification, signature or payment of another store never changes this store's data.
- **S4 — "migración de Raeyz".** Raeyz moves to the per-store scheme with its current account and without a payment outage; the global token and secret are removed at the end.
- **S5 — "pagos en curso".** Preferences created before the switch, and late notifications for them (retries, refunds, chargebacks), keep being processed correctly.
- **S6 — "pruebas sandbox".** The whole flow is proven with two Mercado Pago test sellers and a test buyer, on a local stack, before any production step.

## Current state (evidence, `origin/master` `2550b83`)

| Concern | Today | Where |
|---|---|---|
| Token for preferences | one env token `MERCADOPAGO_ACCESS_TOKEN` | `src/pages/api/ecommerce/intento-pago.ts:69,194`; create/recover/reconcile `:509-552`; `src/lib/mercadoPagoPreference.ts:201-380` |
| `notification_url` | `${APP_BASE_URL}/api/webhooks/mercadopago`, same for every store | `intento-pago.ts:321` |
| Webhook secret and payment fetch | one env secret and the same env token | `src/pages/api/webhooks/mercadopago/index.ts:125-126`; signature `:231-400` (max age 300 s, future skew 30 s); fetch `:472-491` |
| Lookup fallback / dev bypass | both disabled when `NODE_ENV=production` | `index.ts:128-130,434-435` |
| Duplicate deliveries | unique `x_request_id` and `provider_event_id` in `webhook_recepcion_mp` | `20260416190000_mp_webhook_receipt_hardening.sql` |
| Payment attempt lookup | by `id = external_reference` only, no company filter | `index.ts:796,846` |
| Company on attempts | `intento_pago.empresa_id NOT NULL`, no record of which Mercado Pago account was used | local schema |
| Notification body fields already typed | `user_id` (seller account), `live_mode` | `index.ts:10-13` |
| Fetched payment fields typed | `id`, `status`, `status_detail`, `external_reference` (no `collector_id` yet) | `index.ts:17-20` |
| Production | 0 unexpired pending orders, 0 active attempts (read-only check 2026-11-02); `raeyz.com` behind Cloudflare Access, so no live payments | ops checks this session |

## Design

### Data

New table `public.empresa_mercadopago` (one row per store):

| Column | Purpose |
|---|---|
| `empresa_id uuid primary key references empresa(id) on delete restrict` | owner store |
| `mp_user_id bigint not null` | seller account id, from `GET /users/me` at load time |
| `live_mode boolean not null` | test vs real account; must match notifications and payments |
| `webhook_key text not null unique` | random 32-byte url-safe value used in the webhook path; never the company id |
| `access_token_enc text`, `webhook_secret_enc text` | sealed ciphertexts (below) |
| `previous_webhook_secret_enc text null`, `previous_secret_valid_until timestamptz null` | bounded overlap while rotating the webhook secret |
| `key_version smallint not null` | which platform key sealed the values |
| `estado text check (estado in ('activo','inactivo'))` | operator switch |
| `creado_en`, `actualizado_en`, `rotado_en` | audit |

Controls: RLS enabled and forced, no policies; `revoke all` from `public`, `anon`, `authenticated`; `service_role` gets `select` only (writes go through an operator SQL path, below). Unique `mp_user_id` per `live_mode`, so one Mercado Pago account cannot be attached to two stores.

`intento_pago` gains `mp_user_id bigint null`, stamped when the preference is created. Recover, reconcile and the webhook require it to equal the store's current `mp_user_id`. `null` is accepted only on the legacy route (migration).

`webhook_recepcion_mp` gains `empresa_id uuid null`, filled by the per-store route, so every receipt is attributable to a store.

### Encryption (D6-a: public-key sealing)

- The platform holds a key pair per `key_version`. The **private** key lives only in Vercel *Production* (`MP_CREDENTIALS_PRIVATE_KEY`); the **public** key is in the repository or the operator runbook.
- Sealing: ephemeral X25519 + HKDF-SHA256 + AES-256-GCM (Node `crypto`, no new dependency). The ciphertext binds `empresa_id`, the field name and `key_version` as associated data, so a ciphertext copied to another store or another field fails to decrypt.
- Consequences: the operator's laptop never holds a key that can decrypt; the database, a dump or a leaked service-role key reveal only ciphertexts; previews and development cannot decrypt (no private key there) and fail closed.
- Discarded alternative (D6-a): one symmetric AES-256-GCM key, which the operator would also need.

### Operator loading (no credential form in the panel, D6-c)

Command `mp:credentials set --empresa <id> --live|--test`, run from the operator's machine:

1. Reads the token and the webhook secret from stdin (never arguments, never env files, never echoed).
2. Calls `GET https://api.mercadopago.com/users/me` with the token: requires success, takes `id` as `mp_user_id`, requires the Uruguay site (`MLU`); refuses an `mp_user_id` already attached to another store. (Exact response fields to confirm against the API at implementation.)
3. Seals both values with the public key and writes the row through the operator's authenticated SQL path (`supabase db query --linked`), never with a service-role key on the laptop.
4. Prints only: store, `mp_user_id`, `live_mode`, `key_version`, and the webhook URL to configure in the store's Mercado Pago application (`${APP_BASE_URL}/api/webhooks/mercadopago/<webhook_key>`).

Rotation: the same command re-seals; a webhook secret rotation keeps the previous secret valid for at most 24 h (`previous_secret_valid_until`). Deactivation sets `estado = 'inactivo'`.

### Preferences (`POST /api/ecommerce/intento-pago`)

Store from the domain (Gate 5) → load its row → `estado` not active or row missing → `409 pagos_no_configurados` **before** the payment-attempt RPC → decrypt the token in memory for this request only → create/recover/reconcile with that token → stamp `intento_pago.mp_user_id` → `notification_url = ${APP_BASE_URL}/api/webhooks/mercadopago/<webhook_key>`. The env token is never read again after the migration.

### Webhook (`POST /api/webhooks/mercadopago/[webhookKey]`)

Order matters; every rejection leaves payment data unchanged:

1. Resolve `webhookKey` → row. Unknown → `404`, nothing written. Inactive → `200` absorbed, receipt recorded with `empresa_id`.
2. Verify the signature with this store's secret (and the previous one inside its window). Invalid → `401`, as today. Same age and skew limits.
3. Cheap pre-checks on the body: `user_id` must equal `mp_user_id` and `live_mode` must equal the row's, else absorbed.
4. Register the receipt (existing duplicate guards) with `empresa_id`.
5. Fetch the payment with **this store's** token. Mercado Pago only returns payments of that account; a foreign payment id fails and is absorbed.
6. Authoritative checks on the fetched payment: `collector_id` (seller) equals `mp_user_id`, `live_mode` matches, `external_reference` present.
7. Load the attempt by `id = external_reference` **and** `empresa_id = row.empresa_id` **and** `mp_user_id` matches; no match → absorbed.
8. Call `procesar_notificacion_intento_pago` (unchanged; consolidation already locks rows and checks the company).

Dev bypass and lookup fallback stay disabled in production (already so).

### Security controls (checklist)

- Ciphertext only at rest; private key only in Vercel Production; never in previews, development, backups or the repository.
- No credential, secret, ciphertext or `webhook_key` in logs or API responses (redaction test over every log call in the two handlers).
- Decryption fails closed: missing key, wrong `key_version`, tampered ciphertext or associated-data mismatch → the request fails with a generic error, no fallback to any other credential.
- No global fallback after the migration; a store without credentials cannot charge.
- Cross-store guards at three levels: route (`webhook_key`), account (`user_id`, `collector_id`, `mp_user_id`) and data (`empresa_id` on the attempt).
- One account per store (unique `mp_user_id`).
- Table unreachable from `anon`/`authenticated`; writes only through the operator path.
- Cloudflare: the webhook path must bypass Access on the domain of `APP_BASE_URL` (today it is blocked; launch blocker regardless of this gate).

## Raeyz migration and payments in flight

1. **Additive migration:** new table and columns; nothing removed. Old code keeps working.
2. **Load Raeyz credentials** with the operator command, from the same account the env token belongs to (`mp_user_id` must match the account of today's token).
3. **Deploy the new code.** New preferences use the per-store route and stamp `mp_user_id`.
4. **Legacy route** `POST /api/webhooks/mercadopago` stays, pinned explicitly to the Raeyz row (not "a default store"): it verifies with Raeyz's secret, fetches with Raeyz's token, and accepts `mp_user_id null` attempts only for Raeyz. This covers preferences created before step 3 and their late notifications (retries, refunds, chargebacks).
5. **Sunset (D6-b: 30 days without legacy-route traffic):** remove `MERCADOPAGO_ACCESS_TOKEN` and `MERCADOPAGO_WEBHOOK_SECRET` from Vercel, then remove the legacy route in a later commit.
6. **Rollback:** until step 5, reverting the code returns to the env credentials; the new table is ignored.

Payments in flight today: none (0 unexpired pending orders, 0 active attempts; orders expire after 1 hour). Even so, step 4 is kept because Mercado Pago can notify long after payment.

## Sandbox tests (before any production step)

Setup: two Mercado Pago **test sellers** (Uruguay) with their own applications and webhook secrets, one **test buyer**; local Supabase stack; the app exposed through a temporary HTTPS tunnel used as `APP_BASE_URL` (Mercado Pago must reach the webhook); store hosts `tienda-a.localhost` and `tienda-b.localhost` registered locally (if Mercado Pago rejects `http` return URLs, expose both store hosts through the tunnel too). Test credentials live only on the operator's machine and the local database; never in Vercel.

| Case | Expected |
|---|---|
| Buyer pays store A with an approved test card | A's order `pagado`, A's stock deducted, B untouched |
| Same for store B | symmetric |
| Rejected card / pending card | attempt `rechazado` / stays pending; no consolidation |
| Store without credentials | `409 pagos_no_configurados`, no attempt, no Mercado Pago call |
| A's real notification replayed to B's route | `401` (B's secret) |
| Valid B signature carrying an A payment id | fetch with B's token fails → absorbed, no change |
| Payment whose `collector_id` differs from the store | absorbed, no change |
| `external_reference` of a B attempt arriving on A's route | absorbed, no change |
| Duplicate delivery | absorbed by the existing guards |
| Payment of the same account without our `external_reference` (in-store sale with the Mercado Pago Point device) | absorbed as `payment_without_external_reference`, no change (behavior already in today's handler) |
| Legacy route with a pre-switch Raeyz preference | processed with Raeyz's credentials |

Automated tests (no Mercado Pago needed): seal/open round trip, tampered ciphertext, wrong associated data, missing key → fail closed; two-store handler matrix for preferences and webhook with mocked Mercado Pago; table grants and RLS on the local database; log redaction.

## Work units (each its own commit; all high risk)

| Unit | Content | Estimate |
|---|---|---|
| G6-1 | Migration (table, columns, grants), sealing module, operator command, tests | ~250 lines |
| G6-2 | Preferences with the store's token, `409 pagos_no_configurados`, `mp_user_id` stamp, per-store `notification_url`; read-only payment status in the panel (D6-c); tests | ~200 lines |
| G6-3 | Per-store webhook route with the 8-step order, tests (two-store matrix, redaction) | ~250 lines |
| G6-4 | Legacy route pinned to Raeyz, runbook (load, switch, sunset, rollback), docs | ~150 lines |

Each unit: test-first, independent verification, native review, then the sandbox run before any production step.

## Dependencies

- **Gate 5 (done):** store from the domain in `intento-pago`.
- **ADR 0002 / platform-domain gate:** the webhook base is `APP_BASE_URL`; this gate does not depend on buying the platform domain (per-store credentials need no OAuth redirect URI). When the platform moves, each store's Mercado Pago application must get the new webhook URL; the runbook covers it.
- **Verified restore (required, free plan):** no Supabase Pro (user decision 2026-11-02). Before G6-1 reaches production (it creates the credentials table and alters `intento_pago`) there must be a fresh backup that was restored successfully on an isolated local stack, per `docs/operations/respaldo-y-continuidad.md`. The procedure was verified on 2026-11-02 (full restore of the 02/11 backup matches production, including `auth.users` trigger and `storage` policies); it is repeated with a fresh backup before G6-1.
- **Project pause (free plan):** check `supabase projects list` before every production step of this gate and before the sandbox-to-production switch; a paused project stops the webhook.
- **FG Herramientas:** already has an active Mercado Pago account used with the Point device in the store (user, 2026-11-02). Online sales use the same account; pending: confirm it is a business account (RUT, invoicing), who creates the application in that account (D6-d), and how online stock follows in-store sales (questionnaire item 8): Point sales do not update the online stock.

## Decisions (user, 2026-11-02)

- **D6-a** — Encryption: **public-key sealing** (X25519 + HKDF-SHA256 + AES-256-GCM, associated data bound to store, field and key version). The symmetric alternative is discarded.
- **D6-b** — Legacy route sunset: **30 days without legacy-route traffic**, then remove the env credentials, then the route.
- **D6-c** — Panel: **read-only payment status** for store administrators. A panel API (capability `payments.access`, company from the canonical principal) returns only `{ configurado, live_mode, estado }` for the administrator's own company; never tokens, secrets, ciphertext, `mp_user_id` or `webhook_key`. No credential form in this gate.
- **D6-d** — **Each store owns its Mercado Pago application** in its own account and hands the token and webhook secret to the operator through the loading command; the operator never signs in to a store's Mercado Pago account.

## G6-1 implementation specs (authorized 2026-11-03: "adelante 1 y 2")

Scope: schema, sealing module and operator command only. Preferences and webhooks keep using the env credentials until G6-2/G6-3. Local database only; no production apply, no Vercel change, no push without a separate decision.

- **C1 — Migration** `supabase/migrations/20261103120000_mercadopago_per_store_credentials.sql`, one transaction with `lock_timeout`/`statement_timeout` like the other migrations, additive only:
  - `public.empresa_mercadopago` with the columns of "Data" above; checks: `mp_user_id > 0`; `webhook_key ~ '^[A-Za-z0-9_-]{43}$'` (32 random bytes, base64url); `access_token_enc`, `webhook_secret_enc` not null and starting with `v1:`; `previous_webhook_secret_enc` starts with `v1:` when present and is null exactly when `previous_secret_valid_until` is null; `key_version > 0`; `estado in ('activo','inactivo')` default `'activo'`; `unique (mp_user_id, live_mode)`; `empresa_id` FK `on delete restrict`; timestamps default `now()`.
  - RLS enabled **and forced**, no policies; `revoke all` from `public`, `anon`, `authenticated`, `service_role`; `grant select` to `service_role`. Writes happen as `postgres`, which has `BYPASSRLS` locally and in production (checked read-only 2026-11-03).
  - `intento_pago.mp_user_id bigint null` with `check (mp_user_id > 0)`; `webhook_recepcion_mp.empresa_id uuid null references empresa(id) on delete restrict`. Existing rows unchanged.
- **C2 — Sealing module** `src/lib/mercadoPagoCredentials.ts` (server only, Node `crypto`, no new dependency):
  - `generateCredentialKeyPair()` → `{ publicKeyPem, privateKeyPem }` (X25519, SPKI/PKCS#8 PEM).
  - `sealCredential({ publicKeyPem, plaintext, empresaId, field, keyVersion })` → `v1:<ephemeral SPKI DER>:<12-byte IV>:<ciphertext>:<16-byte tag>`, each part base64url. Shared secret X25519(ephemeral private, recipient public); key = HKDF-SHA256(ikm = shared secret, salt = ephemeral SPKI DER ‖ recipient SPKI DER, info = `ecommerce-platform/mercadopago-credentials/v1`, 32 bytes); AES-256-GCM with associated data `${empresaId}|${field}|${keyVersion}` (UTF-8). A new ephemeral key and IV for every seal.
  - `openCredential({ privateKeyPem, sealed, empresaId, field, keyVersion })` → plaintext.
  - `field` ∈ `access_token`, `webhook_secret`; `empresaId` a UUID; `keyVersion` a positive integer; plaintext non-empty and at most 4096 bytes.
  - Every failure throws `CredentialSealError` whose `code` and `message` are only one of `invalid_input`, `invalid_format`, `decryption_failed`; never the plaintext, the sealed value or a key. No logging.
- **C3 — Operator command** `scripts/mp-credentials.mjs` (logic in `scripts/lib/mp-credentials.mjs`, injectable `fetch`, SQL runner and stdin), npm script `mp:credentials`:
  - `keygen --out-dir <dir> --key-version <n>`: the directory must exist and be outside the repository; writes `mercadopago-credentials-v<n>.public.pem` (mode 0644) and `mercadopago-credentials-v<n>.private.pem` (mode 0600); refuses to overwrite; prints only the two paths.
  - `set --empresa <uuid> --mode live|test --key-version <n> --public-key-file <path> --target local|linked [--project-ref <ref>]` (`--project-ref` required exactly for `linked`):
    1. reads exactly two non-empty lines from stdin: access token, then webhook secret; secrets are never accepted as arguments or environment variables;
    2. `GET https://api.mercadopago.com/users/me` with the token must answer 200 with a positive integer `id` and `site_id` `MLU`; otherwise exit 1 naming only the failed check;
    3. seals both values (C2), generates `webhook_key`, and runs one `insert` with only ids and ciphertexts through `supabase db query --local|--linked [--project-ref <ref>] --output-format json -f <file>`; the SQL file lives in a private temporary directory (0700/0600) and is deleted in every outcome;
    4. a store that already has a row → exit 1 `credenciales_ya_configuradas` (rotation is a later unit); an account already attached to another store (`unique (mp_user_id, live_mode)`) → exit 1 `cuenta_ya_asociada`; in both cases nothing changes;
    5. success prints only: company id, `mp_user_id`, `live_mode`, `key_version`, `Webhook path: /api/webhooks/mercadopago/<webhook_key>`.
  - Exit codes: 0 success, 1 validation or database failure, 2 usage error (unknown or missing flag). The plaintext token and secret never appear in stdout, stderr, arguments, environment, files or the database.
- **C4 — Existing behavior.** Checkout, preferences, webhook and every existing suite behave as before; the migration only adds.
- **C5 — Docs.** README gets a short "Mercado Pago credentials (operator)" section with both subcommands; this document records evidence per task.

## Tasks (G6-1)

| ID | Specs | Route | Commit |
|---|---|---|---|
| T1 | C1, C4 | worker: migration + `scripts/mercadopago-credentials-db.test.mjs` (privileges, RLS, constraints, FK, new columns), applied to the local database | — |
| T2 | C2 | worker: sealing module + `scripts/mercadopago-credentials.test.mjs` | — |
| T3 | C3, C5 | worker: operator command + `scripts/mp-credentials-cli.test.mjs` (mocked Mercado Pago) + local end-to-end `set` in the DB test + README | — |
| T4 | C1–C5 | independent verify + full suites + native review; one commit per task | — |

## Log

- **L1** (user, 2026-11-02): "Autorizo el merge del PR #50, adoptar D1 (credenciales cifradas por comercio) como decisión arquitectónica y preparar Gate 6 exclusivamente como documentación y diseño." … "P1 y la implementación de Gate 6 quedan pendientes de autorización. Sin cambios productivos adicionales."
- **L2** (evidence): PR #50 merged as `2550b83`; production deploy Ready, app code unchanged (`git diff 8dcc3da 2550b83 -- src scripts supabase` empty).
- **L3** (correction): an earlier session note said the webhook lookup fallback was not restricted to non-production; `index.ts:128-130` shows it is (`NODE_ENV !== "production"`).
- **L4** (user, 2026-11-02): paused for usage limits after ADR 0003 (`ea8c111`); resumed with "retoma laburo".
- **L5** (user, 2026-11-02): "Decisión: no vamos a contratar Supabase Pro. Continuamos con el plan gratuito." … "Mantenemos la restauración verificable como requisito antes de migraciones de datos sensibles." Dependencies updated; backup/restore/continuity strategy in `docs/operations/respaldo-y-continuidad.md`.
- **L6** (user, 2026-11-02): D6-a "Clave pública (recomendado)"; D6-b "A los 30 días sin tráfico (recomendado)"; D6-c "Sí, solo lectura (recomendado)"; D6-d "Cada comercio, en su cuenta (recomendado)". Implementation still not authorized.
- **L7** (user, 2026-11-02): "ellos tienen su propia cuenta de mercado pago hasta con pos" … "pos de mercadopago el amarillo" (Mercado Pago Point).
- **L8** (user, 2026-11-03): "adelante 1 y 2" — push and PR of the docs branch (#52) and implementation of G6-1 in a local branch, test-first. Branch `feat/mercadopago-credentials-store`, stacked on `docs/verified-restore-procedure` (`ebb5763`).
