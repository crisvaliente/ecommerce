# Gate 5 — The domain decides the store during checkout

Buyer write APIs resolve the store from the request `Host` (`empresa_dominio`), trust only that store's own origin, and build payment return and sign-up URLs for that domain. Today they rely on a client-sent `empresa_id` and on the single `APP_BASE_URL`, so a second store's checkout would be rejected (`403 untrusted_origin`) or send buyers back to raeyz.com.
Branch `feat/request-scoped-store`, stacked on `fix/checkout-availability-guard` (Gate 4, `7e119f2`, not merged). No push, PR, merge or production change.

## Specs

Gate definition accepted by the user (audit report, section F, row "5. Comercio por solicitud"; user: "seguimos"):

> "El dominio decide el comercio en todo el checkout"
> "`pedido` e `intento-pago` resuelven la empresa por `Host` y rechazan un `empresa_id` distinto; orígenes, URLs de retorno del pago y login se arman por dominio"
> "Pruebas con mocks de dos dominios; una prueba de base de dos empresas que confirme el rechazo cruzado"

- **S1 — "`pedido` … resuelven la empresa por `Host` y rechazan un `empresa_id` distinto".** `POST /api/ecommerce/pedido` takes the store from the `Host` header through `empresa_dominio` (same rules as the storefront: direct `Host` only, no forwarded headers, no fallback). The body `empresa_id` is optional; when present and different from the store's company it answers `400 { "error": "empresa_no_coincide_con_dominio" }`. Unknown or invalid host: `404 { "error": "tienda_no_encontrada" }`. Lookup failure: `503 { "error": "tienda_no_disponible" }` with `Cache-Control: no-store`. No rejected request reaches the order RPC.
- **S2 — "orígenes … se arman por dominio".** The buyer write APIs (`POST /api/ecommerce/pedido`, `POST /api/ecommerce/intento-pago`, `PUT /api/ecommerce/mi-cuenta/direccion`) accept an `Origin` (or `Referer`) only when its hostname is the store hostname resolved from that same request; any other origin answers `403 { "error": "untrusted_origin" }`, including another registered store. A request without origin keeps today's rule (allowed for bearer or cookie-less clients). Panel APIs are unchanged.
- **S3 — "`intento-pago` resuelven la empresa por `Host`".** `POST /api/ecommerce/intento-pago` works only for an order of the store resolved from `Host`; an order of another store answers `404 { "error": "pedido_no_encontrado" }` without creating a payment attempt or calling Mercado Pago. Unknown host / lookup failure as in S1.
- **S4 — "URLs de retorno del pago … se arman por dominio".** The Mercado Pago `back_urls` use the store's origin: the validated request `Origin`, otherwise `https://<store hostname>`. `notification_url` stays on `APP_BASE_URL` (one platform webhook; per-store routing belongs to Gate 6).
- **S5 — "login se arman por dominio".** Sign-up confirmation emails and Google sign-up return to `<current origin>/auth/callback`, as Google login already does.
- **S6 — Existing behavior.** Checkout on a registered domain (raeyz.com) answers exactly as before for every existing case; the order idempotency contract is unchanged; panel APIs are untouched.
- **S7 — Docs.** README (Gate 2 section says OAuth and payment URLs remain instance-wide), the checkout flow doc and the launch checklist (each store domain, including `www`, must be in `empresa_dominio` and in the Supabase Auth redirect URLs).

## Tasks

| ID | Specs | Route | Commit |
|---|---|---|---|
| T1 ✅ | S1, S2, S4 | inline: `src/lib/storeRequest.ts` (store resolution, store origin rule, store origin URL, shared `empresa_dominio` lookup) + `scripts/store-request.test.mjs`; `/coleccion` reuses the lookup | `94ce443` |
| T2 ✅ | S1, S2, S6 | inline: `pedido.ts` and `mi-cuenta/direccion.ts` + handler tests with two domains | `96b2ee3` |
| T3 ✅ | S2, S3, S4, S6 | inline: `intento-pago.ts` + handler tests | `8791260` |
| T4 ✅ | S5, S7 | inline: sign-up redirects + docs | `2e0cc6f` |
| T5 | S1–S7 | checks, independent verify (high-risk item 2: origin guard and store boundary), native review per assess | — |

## Log

- **L1** (user, 2026-10-29): "excelente, seguimos" — after the Gate 4 report that listed push/PR, production push and Gate 5 as next decisions. Push, PR and production remain pending user decisions; only Gate 5 proceeds.
- **L2** (evidence): `validateTrustedOrigin` (`src/lib/apiSecurity.ts:40-51,83-103`) trusts only `APP_BASE_URL`/`NEXT_PUBLIC_*` origins; `pedido.ts:147` takes `empresa_id` from the body; `intento-pago.ts:285-298` builds `notification_url` and `back_urls` from `APP_BASE_URL`; `register.tsx:47,90` use `buildOAuthCallbackUrl()`, whose `APP_BASE_URL` is inlined at build time (`next.config.ts` `env`); `login.tsx:61-64` already uses `window.location.origin`. `src/services/authService.ts` has no importers (dead code, out of scope).
- **L3** (decisions): the store origin is compared by normalized hostname (port ignored), reusing `normalizeStorefrontHost`; a present but unparsable or non-http(s) origin is untrusted (stricter than `validateTrustedOrigin`, which treats it as missing). The cross-store order check in `intento-pago` masks as `404 pedido_no_encontrado`, the code the RPC already returns for orders the buyer cannot use. The panel keeps `validateTrustedOrigin`; where store admins work (own domain or a platform domain) is a later product decision.
- **L4** (test plan): handler tests load the real `storeRequest.ts` (Node `require` of `.ts` works under `--experimental-strip-types`) and fake only Supabase/Mercado Pago. "una prueba de base de dos empresas que confirme el rechazo cruzado": the database already rejects another company's product (`checkout-availability-db` S1 foreign test, Gate 4); the new cross-store rejections live in the API layer and are proven with two-domain handler tests.
- **L5** (T1): RED `scripts/store-request.test.mjs` 0/7 (module absent). GREEN 7/7. First `tsc` failed on union narrowing (`if (resolution.ok)`), fixed with `resolution.ok === false` as in Gate 2 F1; `tsc` exit 0. `/coleccion` uses `createStoreDomainLookup(supabaseServer)`; `storefront-tenant.test.mjs` 7/7.
- **L6** (T2): the first RED was a harness failure (the old handler called `validateTrustedOrigin`, absent from the mock), not evidence; the tests now load the real `apiSecurity.ts` and stub only rate limiting, so old code runs as in production. Meaningful RED `checkout-order-api` 4/8: the four S1 tests failed (old code: 403 for the store's own origin, `400 empresa_id_required`, accepted another store's `empresa_id`, accepted an unknown domain); the S2 rejections and the S6/Gate 4 responses passed on old code (differential evidence). GREEN 8/8; a `null` body `empresa_id` (possible from `buyerCheckout.ts:67`) was added RED then GREEN as "absent". `buyer-address-api` RED 2/4 (own-store origin 403, unknown domain 403 instead of 404), GREEN 4/4.
- **L7** (T3): RED `payment-attempt-api` 2/6; on old code a ferreteria buyer returned to `https://raeyz.com/checkout/resultado` and the store's own origin got `403 untrusted_origin`. GREEN 6/6; `checkout-idempotency.test.mjs` 16/16 (static checks on `intento-pago.ts`).
- **L8** (T4): RED `auth-redirect` 2/3 (`register.tsx` built both redirects with `buildOAuthCallbackUrl()`). GREEN 3/3 with `instance-config` 6/6.
- **L9** (slice note): the git slice counter includes the stacked Gate 4 commits; Gate 5 alone is `7e119f2..2e0cc6f`.
