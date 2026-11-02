# Gate — Platform on a neutral domain (PREPARED, not authorized for implementation)

Moves the shared platform (panel, admin sign-in, webhooks) off `raeyz.com` to a neutral domain chosen later, and makes adding a store a data operation. Decision record: `docs/architecture/decisiones/0002-plataforma-dominio-neutro.md`.
Status 2026-11-02: documentation, dependency analysis and minimal proposal only. No code, infrastructure or production change. The platform domain is pending choice and purchase.

## Specs

User statements (2026-11-02), verbatim:

> "La plataforma multiempresa es un producto independiente de Raeyz y FG Herramientas. Cada comercio tendrá su dominio; el panel, la autenticación y los webhooks compartirán una infraestructura con identidad propia."
> "El dominio de la plataforma queda pendiente de elección y compra. La solución debe ser configurable y escalable a futuros comercios."
> "Priorizamos el lanzamiento de FG Herramientas. Coordiná las dependencias con Gate 6 para evitar duplicaciones."

- **S1 — "Cada comercio tendrá su dominio".** A store domain is added with one operator command that registers `hostname → empresa` in `empresa_dominio` without ever reassigning a hostname owned by another company, and refuses the platform hostname (the host of `APP_BASE_URL`). The bootstrap no longer registers the `APP_BASE_URL` host as the configured store's domain; the store domain is an explicit input.
- **S2 — "el panel, la autenticación … compartirán una infraestructura".** On the platform hostname, `/` and a completed sign-in lead to `/panel` (today sign-in always returns to `/coleccion`). Store pages on the platform hostname never show a store: `/coleccion` already answers 404 there because the hostname is not in `empresa_dominio`.
- **S3 — "con identidad propia".** The panel shell and the platform pages do not show a store's brand (today `AdminLayout`/`Sidebar` render `instanceConfig.store.name`, e.g. "Raeyz Admin").
- **S4 — "configurable".** Moving the platform is a configuration change: `APP_BASE_URL` (Production), the Vercel domain, Supabase Auth Site URL and redirect URLs, Cloudflare rules. A written runbook covers the switch, the transition for Raeyz administrators and the rollback (revert `APP_BASE_URL`).
- **S5 — "Coordiná las dependencias con Gate 6 para evitar duplicaciones".** This gate does not touch the webhook handler nor how `notification_url` identifies a store; it only moves the base URL through `APP_BASE_URL`. Gate 6 owns the per-store webhook route and credentials.

## Tasks (proposed)

| ID | Specs | Proposal | Size / risk |
|---|---|---|---|
| P1 | S1 | Split the bootstrap: platform URL vs explicit store domain; operator command `domain:add <hostname> <empresa>` reusing `scripts/lib/tenant-domain.mjs` (`ensureTenantDomain` already refuses reassignment on `23505`); reject the platform hostname. Tests with the local database. | ~150 lines incl. tests; item 1 (writes the domain registry, guarded) |
| P2 | S2 | Platform-host behavior: detect the platform hostname from `APP_BASE_URL`; `/` and sign-in return go to `/panel` there; store domains unchanged. | ~80 lines incl. tests; item 2 (sign-in redirect) |
| P3 | S3 | Neutral panel identity: platform name from configuration (decision D2) and the signed-in administrator's company name in the panel header. | ~60 lines incl. tests |
| P4 | S4 | Runbook only (no code): domain purchase checklist, Vercel/Cloudflare/Supabase steps, Raeyz admin transition, rollback. Executed only when the domain exists and the user authorizes. | docs; item 5 when executed |

P1–P3 do not need the domain to exist: they are testable with local hostnames and can be merged before the switch. P4 is the only step that needs the purchased domain.

## Dependencies with Gate 6 (Mercado Pago per store)

| Shared concern | Owner | Why it matters |
|---|---|---|
| Base URL of the webhook (`notification_url`) | this gate, via `APP_BASE_URL` only | Moving the base needs no code. Old notification URLs keep working while `raeyz.com` stays attached to the same deployment; Cloudflare Access must exempt the webhook on the domain that receives it. |
| Webhook route shape and store identification | Gate 6 | With **per-store credentials** each store has its own Mercado Pago application and webhook secret, so the store must be known before verifying the signature (store key in the path). With **OAuth** there is one platform application and one secret; the store comes from the payment's account. The shape depends on that choice. |
| OAuth redirect URI | Gate 6 | If Gate 6 chooses OAuth, the Mercado Pago application needs a stable redirect URI on the **platform domain**: the domain must exist before Gate 6 can be tested end to end. With per-store credentials there is no redirect URI. |
| Webhook handler, credential storage, signature verification | Gate 6 | Not touched here. |

Consequence: the Gate 6 model decision is on the critical path of this gate's P4 timing (OAuth → buy the platform domain first). Per-store credentials remove that ordering constraint.

## Critical path to launch FG Herramientas

1. **Decisions (parallel, user):** Gate 6 model (D1); platform domain name and purchase (D2); FG Herramientas domain; questionnaire answers (payments, delivery, catalog size).
2. **Code (can overlap):** this gate P1–P3; Gate 6; per-store brand and contact (Gate 7); delivery v1 (Gate 8).
3. **Operations:** Supabase Pro and a proven restore procedure; platform switch (P4); FG Herramientas onboarding (company, administrator, `domain:add`, Mercado Pago, brand); Cloudflare (store domain open, webhook exempted); closed pilot.

## Open decisions

- **D1** — Gate 6 model: per-store encrypted credentials (recommended for two stores onboarded by the operator) or Mercado Pago OAuth.
- **D2** — Platform name and domain; whether the panel header shows the platform name, the administrator's company, or both.
- **D3** — Transition for Raeyz administrators: move the panel at once, or keep `raeyz.com` as an extra trusted panel origin for a fixed period.
- **D4** — Session storage key (`raeyz.supabase.auth`, from `instanceKey`): renaming it signs everyone out; keep it until a planned moment.

## Log

- **L1** (user, 2026-11-02): "espera, el dominio no quiero que sea raeyz" → chose "La plataforma: panel y webhook en un dominio neutro".
- **L2** (user, 2026-11-02): "Autorizo documentar la decisión como ADR 0002 y preparar el gate de dominio neutro, sin implementar todavía." Principle and constraints quoted in Specs. "Por ahora: documentación, análisis de dependencias y propuesta mínima. Sin cambios de código, infraestructura ni producción."
- **L3** (evidence, `origin/master` `8dcc3da`): `APP_BASE_URL` consumers — `next.config.ts:4,38`; `src/lib/apiSecurity.ts:41-43` (panel write APIs `src/pages/api/panel/{categorias,productos,pedidos/[id],productos/[id]/modo-variantes}.ts`, `src/lib/orderOperationsApi.ts`); `src/pages/api/ecommerce/intento-pago.ts:321` (`notification_url`); `scripts/bootstrap-instance.mjs:191,204` (registers the `APP_BASE_URL` host as the store domain). Brand: `AdminLayout.tsx:24`, `Sidebar.tsx:45`, `_app.tsx:21-25`, `_document.tsx:13`, `formatters.ts:3-8`. Sign-in return: `login.tsx:25` → `getSafeAuthReturn` always `/coleccion`. Session key: `supabaseClient.ts` (`${instanceKey}.supabase.auth`, `instanceKey: "raeyz"`). Production `empresa_dominio`: only `raeyz.com`.
