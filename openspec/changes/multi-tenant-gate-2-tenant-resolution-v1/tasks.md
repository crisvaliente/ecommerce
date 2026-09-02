# Tasks — Multi-Tenant Gate 2: Tenant Resolution v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 475–790 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: private domain registry + pure resolver → PR 2: SSR/catalog/image isolation + two-host proof → PR 3: collision-safe bootstrap + rollout docs + full regressions |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

The user explicitly authorized a size exception for completing Gate 2 in the working tree without commits, push, or PRs. Implementation must preserve the reviewable TDD work-unit boundaries below.

## Scope guardrails

- Minimal v1 changes only public `src/pages/coleccion/index.tsx` read tenancy from configured slug to direct-`Host` resolution. Keep branding, locale, UYU currency, metadata, shared assets, auth namespace, provisioning slug, OAuth URLs, and payment URLs instance-wide.
- Do not add domain UI/lifecycle/verification, wildcard or suffix routing, Punycode, `X-Forwarded-Host` trust, image schema/storage-policy changes, preview/local fallbacks, or unrelated page cleanup.
- Do not host-bind or otherwise alter checkout, order, payment, webhook, idempotency, or atomic stock mutation contracts.
- Every implementation task keeps its tests with its behavior. Record the exact command, exit code, test names/counts, and relevant output. RED evidence must show the intended assertion failure, not an unrelated import/environment failure.

## RED

- [x] **R1 — Specify direct-Host extraction, normalization, and resolver failure behavior.**
  - **Paths:** expand `scripts/storefront-tenant.test.mjs`; use `src/lib/storefrontTenant.ts` only as the discovery target for its current public API—do not change implementation in RED.
  - **Start/finish:** begin from the slug resolver; finish with failing table tests for exactly one matching `rawHeaders`/`headers.host` value, case, ports `1..65535`, one terminal dot, `localhost`, IPv4-shaped hosts, and DNS length edges. Reject missing/empty/array/repeated/comma/inconsistent values, whitespace/control/DEL, non-ASCII, scheme, `/`, `\\`, query, fragment, userinfo, `%`, brackets/IPv6, malformed labels, multiple dots/colons, and invalid ports. Add resolver cases proving invalid input makes zero lookup calls; unknown/error/throw/malformed UUID rows fail closed; two known hosts return distinct UUIDs; and no slug/default-company argument exists.
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs`
  - **RED evidence:** non-zero exit with named failures attributable to the absent host API/behavior; record lookup spy counts for invalid inputs. Runtime harness: `N/A`—this unit is a pure request/lookup contract.
  - **Rollback boundary:** remove only the new host extraction/normalization/resolver test blocks from `scripts/storefront-tenant.test.mjs`; the prior Gate 1 test remains runnable.

- [x] **R2 — Specify SSR fail-closed orchestration, service-role query scope, query overrides, and image row-to-object isolation.**
  - **Paths:** add orchestration tests to `scripts/storefront-tenant.test.mjs` (or a narrowly named `scripts/storefront-catalog.test.mjs` if isolation reduces complexity); target `src/pages/coleccion/index.tsx` and planned `src/lib/storefrontCatalog.ts`.
  - **Start/finish:** finish with failing tests showing invalid and unknown hosts return generic 404 behavior, lookup failure returns 503 plus `Cache-Control: no-store` and one bounded log, and none invokes catalog/stock/variant/image callbacks. For a known host, assert products and stock use `.eq("empresa_id", empresaId)`, variants use both company and scoped product IDs, and images use only scoped product IDs. Supply valid company-B IDs/slugs/domains through query, GET body, cookies, `Origin`, `Referer`, and `X-Forwarded-Host`; assert only direct Host A reaches lookup/catalog arguments.
  - **Corrected R1-001 coverage:** add bidirectional foreign-key signing spies: a tenant-B canonical object key attached to an A product row, and an A key attached to a B product row, must never be signed or returned. Also fail on non-member `producto_id`, differing non-null `path`/`url_imagen`, invalid present `path` despite valid legacy data, empty/path traversal/nested/control/query/fragment/absolute/bucket-qualified keys; accept legacy `url_imagen` only when `path IS NULL` and the exact key starts `empresa/${empresaId}/producto/${row.producto_id}/` with one non-empty filename segment. Verify rejected ordered rows fall through to the next valid row and otherwise yield `imagen_url: null`.
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` (and the new catalog test command if split).
  - **RED evidence:** non-zero exit with named 404/503, override, explicit-scope, and signer-never-called failures. Runtime harness: `N/A`—the injected SSR/catalog harness is the boundary at RED.
  - **Rollback boundary:** remove only the new orchestration/catalog test file or blocks; no runtime source is changed.

- [x] **R3 — Specify the private registry and bidirectional two-host DB isolation.**
  - **Paths:** create `scripts/storefront-tenant-db.test.mjs`; inspect `scripts/catalog-stock-isolation-db.test.mjs` for local Supabase setup/cleanup conventions without changing Gate 1 tests.
  - **Start/finish:** finish with a deterministic two-company/two-domain fixture containing distinct published products, variants/sizes, stock values, valid same-product image keys, and persisted cross-wired image rows in both directions. Add failing assertions for normalized hostname constraints, globally unique ownership, unchanged owner after collision, cascade-on-company-delete, service-role `SELECT`/`INSERT`, denied `public`/`anon`/`authenticated` enumeration, and absent service-role `UPDATE`/`DELETE`. Exercise Host A→A and Host B→B with opposite-tenant exclusions and explicit company predicates.
  - **Verify:** `pnpm exec supabase db reset --local && node --test scripts/storefront-tenant-db.test.mjs`
  - **RED evidence:** reset succeeds, then the test exits non-zero because `public.empresa_dominio`/required isolation behavior is absent; record the named first expected failure. Runtime harness: local Supabase is the runtime boundary.
  - **Rollback boundary:** delete only `scripts/storefront-tenant-db.test.mjs` and its self-cleaning fixture data.

- [x] **R4 — Specify collision-safe canonical bootstrap.**
  - **Paths:** extend `scripts/instance-config.test.mjs` or create `scripts/bootstrap-instance.test.mjs`; target `scripts/bootstrap-instance.mjs`.
  - **Start/finish:** finish with failing helper/adapter tests proving raw non-ASCII `APP_BASE_URL` is rejected before URL Punycode conversion, runtime normalization is reused, plain insert creates a mapping, PostgreSQL `23505` followed by the same owner is idempotent, a different owner throws without update/upsert/reassignment, and all other insert/read errors propagate. Assert non-secret JSON output reports hostname and created/already-present state.
  - **Verify:** `pnpm test:instance-config` plus `node --test scripts/bootstrap-instance.test.mjs` if a new file is used.
  - **RED evidence:** non-zero exit with named normalization/idempotency/collision failures. Runtime harness: `N/A`—database collision behavior is triangulated in T2.
  - **Recovery evidence:** `node --test scripts/bootstrap-instance.test.mjs` exited 0 with 5/5 tests. The spawned bootstrap emitted `tenant_domain` as exactly `{ hostname, created }`; first run returned the canonical hostname with `created: true`, and the second returned the same hostname with `created: false` (already present). No implementation change was required.
  - **Rollback boundary:** remove only the new bootstrap tests; retain existing instance-config coverage.

## GREEN

- [x] **G1 — Add the private additive domain registry and make its RED DB contract pass.**
  - **Paths:** create the next timestamped migration after `supabase/migrations/20260902120000_multi_tenant_gate_1_catalog_stock_isolation.sql`, named `supabase/migrations/<timestamp>_multi_tenant_gate_2_empresa_dominio.sql`; update only the registry portions of `scripts/storefront-tenant-db.test.mjs` if test plumbing—not expectations—requires it.
  - **Start/finish:** add one transactional `public.empresa_dominio` table with normalized `hostname` primary key, non-null `empresa_id` FK with `ON DELETE CASCADE`, timestamp, length/ASCII DNS-label checks, and company index. Enable and force RLS, create no policy, revoke all from `public`, `anon`, `authenticated`, and `service_role`, then grant service role only `SELECT, INSERT`. Add no environment-specific seed and change no existing company/Gate 1 policy.
  - **Verify:** `pnpm exec supabase db reset --local && node --test scripts/storefront-tenant-db.test.mjs`
  - **GREEN evidence:** exit 0 with constraint, collision preservation, cascade, grant, and enumeration-denial test names/counts. Runtime harness: local Supabase reset/test output.
  - **Rollback boundary:** remove only the new additive migration before deployment; after deployment, rollback requires a separate operator-reviewed drop only after runtime/bootstrap no longer depends on it.

- [x] **G2 — Implement the pure direct-Host normalizer and authoritative resolver.**
  - **Paths:** replace the slug contract in `src/lib/storefrontTenant.ts`; keep all unit coverage in `scripts/storefront-tenant.test.mjs`.
  - **Start/finish:** implement exhaustive typed extraction/normalization/result unions from the corrected design. Inspect `rawHeaders` only for multiplicity/identity evidence, select only `headers.host`, normalize ASCII deterministically, and inject an exact-hostname lookup. Invalid input skips lookup; null is unknown; returned error, throw, or malformed UUID is lookup failure. Do not import/accept `instanceConfig`, slug, query, cookies, body, forwarding headers, or fallback tenant.
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs`
  - **GREEN evidence:** exit 0 with every normalization row and exact lookup-call count. Runtime harness: `N/A`—pure boundary.
  - **Rollback boundary:** restore only `src/lib/storefrontTenant.ts` and the corresponding Gate 2 unit blocks, returning to the prior slug resolver without touching database state.

- [x] **G3 — Integrate resolution into public SSR and enforce catalog/image isolation.**
  - **Paths:** create `src/lib/storefrontCatalog.ts`; update `src/pages/coleccion/index.tsx`; complete the R2 tests in `scripts/storefront-tenant.test.mjs` or `scripts/storefront-catalog.test.mjs`.
  - **Start/finish:** add the service-role domain adapter (`select empresa_id`, exact hostname, `maybeSingle`) beside SSR; resolve only `context.req`. Return `{ notFound: true }` for invalid/unknown and 503/no-store generic unavailable props for lookup failure, with one safe bounded log and no Supabase/raw-host/alternate-input data. For known hosts call `loadStorefrontCatalog(empresaId, client)` only. Explicitly scope product, stock, and variant queries by resolved company; use only scoped product IDs for variant/image reads; skip downstream reads when IDs are empty.
  - **Corrected R1-001 implementation:** before any signing call, validate row membership in the exact scoped-product set, derive the exact case-sensitive company/product prefix, apply the no-repair candidate precedence and one-filename-segment rules, discard every mismatch, and sign only the returned object key. Continue to the next ordered valid row or expose `imagen_url: null`. Do not add `empresa_id` to image rows or alter storage policies.
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` (plus the catalog test command if split).
  - **GREEN evidence:** exit 0 with explicit query arguments, zero-call failure branches, query-override assertions, and signer argument/output assertions in both cross-wire directions. Runtime harness: deferred to T3 HTTP smoke after DB mappings exist.
  - **Rollback boundary:** remove `src/lib/storefrontCatalog.ts` and revert only `src/pages/coleccion/index.tsx` plus its Gate 2 tests; do not alter checkout/payment/order code or Gate 1 migration.

- [x] **G4 — Register the canonical host collision-safely and document migration-first operations.**
  - **Paths:** update `scripts/bootstrap-instance.mjs`, its R4 test file, `package.json`, `README.md`, and `local-env.sample` only as needed.
  - **Start/finish:** after `ensureTenant`, reject non-ASCII raw `APP_BASE_URL`, retain existing URL-origin validation, normalize `new URL(appBaseUrl).host` through the runtime helper, and plain-insert `{ hostname, empresa_id }`. On `23505`, compare ownership by exact read; accept same owner and reject different owner without mutation. Add `test:storefront-tenant:db` for discoverability. Document migration → explicit mappings → trusted Host validation → runtime deployment → smoke order; production/local/preview/alias/health-check inventory; direct `Host` trust and no `X-Forwarded-Host`; 404/503 diagnostics; shared-v1 branding; and runtime-first rollback that retains registry/Gate 1 and never adds slug fallback.
  - **Verify:** `pnpm test:instance-config && node --test scripts/bootstrap-instance.test.mjs` if created, then `pnpm exec supabase db reset --local && pnpm test:storefront-tenant:db`.
  - **GREEN evidence:** exit 0; capture created, same-owner, different-owner, and preserved-owner assertions plus sanitized JSON output. Runtime harness: local Supabase bootstrap scenario with secrets redacted.
  - **Recorded result:** bootstrap suite exited 0 with 5/5 tests, including real emitted JSON for canonical hostname, created, already-present, and exact object shape; prior instance-config 6/6 and Gate 2 DB 2/2 evidence remains persisted in `apply-progress.md`.
  - **Rollback boundary:** revert only bootstrap registration, optional package script, and Gate 2 operational text; retain the additive registry if runtime has ever depended on it.

## TRIANGULATE

- [x] **T1 — Prove fail-closed alternate-input behavior beyond happy paths.**
  - **Paths:** strengthen only `scripts/storefront-tenant.test.mjs` / `scripts/storefront-catalog.test.mjs` if a missing edge is exposed; implementation targets remain `src/lib/storefrontTenant.ts`, `src/lib/storefrontCatalog.ts`, and `src/pages/coleccion/index.tsx`.
  - **Start/finish:** run valid Host A with valid B identifiers in query/body/cookie/Origin/Referer/`X-Forwarded-Host`; then malformed, unknown, lookup-error, thrown-error, and malformed-row cases. Finish only when mapping/catalog spy counts are respectively `0/0`, `1/0`, and `1/0`, lookup failure is 503/no-store, and no case retries with slug/canonical identity.
  - **Verify:** `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` (plus catalog test if split).
  - **Evidence:** exit 0 and recorded call arguments/counts and status/cache assertions. Runtime harness: injected SSR request/response harness.
  - **Recorded result:** after adding the missing spy assertions first, the focused suite passed twice with 7/7 tests and exit 0. Invalid/malformed Host cases proved `0/0` lookup/catalog calls; unknown Host and each lookup error/throw/malformed-row case proved `1/0`; valid Host A ignored company-B query/body/cookie/Origin/Referer/`X-Forwarded-Host`, looked up only `a.test`, loaded only tenant A, and lookup failures returned 503 with `Cache-Control: no-store`. Existing implementation required no change.
  - **Rollback boundary:** remove only newly added edge-case rows; do not weaken the GREEN contract to satisfy them.

- [x] **T2 — Prove DB-backed two-host, stock, registry, and cross-wired-image isolation in both directions.**
  - **Paths:** finalize `scripts/storefront-tenant-db.test.mjs`; do not modify `scripts/catalog-stock-isolation-db.test.mjs` expectations.
  - **Start/finish:** against a reset stack, verify A→A and B→B distinct products, variants/sizes, stock, and valid images; assert opposite data exclusion both ways. Persist each tenant's image row with the other tenant's real canonical private key and prove the foreign key is absent from signer calls/props while a same-product key signs; foreign-only rows produce null. Repeat with conflicting valid query/header identifiers. Verify duplicate rejection, idempotent same-owner bootstrap, cross-owner preservation, cascade deletion, and role denial.
  - **Verify:** `pnpm exec supabase db reset --local && node --test scripts/storefront-tenant-db.test.mjs && node --test scripts/catalog-stock-isolation-db.test.mjs`
  - **Evidence:** exit 0 with two directional fixture identities/values, signer exclusions, privilege checks, and Gate 1 test count recorded. Runtime harness: local Supabase; fixture cleanup succeeds even after assertions.
  - **Recorded result:** initial and final reset-backed runs both exited 0. Gate 2 DB passed 2/2 and Gate 1 isolation passed 1/1. Host A/B resolved only their mapped companies despite conflicting query/body/cookie/Origin/Referer/`X-Forwarded-Host`; distinct products, variants and stock stayed bidirectionally isolated; valid same-tenant keys signed, cross-wired keys never signed or returned, and foreign-only rows yielded `imagen_url: null`; unknown host returned fail-closed without catalog access; same-owner domain registration was idempotent, cross-owner registration failed without reassignment, and registry role/grant/cascade checks passed. No production implementation change was required.
  - **Rollback boundary:** remove only the Gate 2 DB test/fixtures; Gate 1 script and migration stay unchanged.

- [x] **T3 — Validate local two-host HTTP behavior and the production Host trust prerequisite.**
  - **Paths:** execute the runbook in `README.md`; amend only its Gate 2 operational section if observations require clarification.
  - **Start/finish:** with explicit `tenant-a.localhost`/`tenant-b.localhost` mappings and `pnpm dev` running, execute `curl --resolve tenant-a.localhost:3000:127.0.0.1 -sS -D /tmp/tenant-a.headers -o /tmp/tenant-a.html http://tenant-a.localhost:3000/coleccion` and the equivalent command for tenant B; also run unknown/malformed and conflicting-query probes. Before release, run equivalent platform-approved probes to prove the externally requested custom domain is the single direct Node/Next `Host`; if only `X-Forwarded-Host` preserves it, stop rollout.
  - **Verify:** compare status/header/body markers for A and B; verify unknown is 404, forced lookup failure is 503 with `Cache-Control: no-store`, conflicting query does not change catalog, and logs contain only bounded lookup-failure data.
  - **Evidence:** record exact curl commands, status lines, tenant-specific non-secret markers, observed direct-Host multiplicity, and sanitized server log event. Do not record credentials or alternate tenant data in logs.
  - **Blocked attempt:** local Next.js 16.1.1 smoke with explicit `tenant-a.localhost`/`tenant-b.localhost` mappings returned 404 for both valid hosts, as well as the expected 404 for unknown/malformed hosts. The conflicting-query/`X-Forwarded-Host` request to Host A also returned 404, so tenant markers were never exposed and the induced 503 step was not reached. Next logged plain `GET /coleccion 404` entries with no bounded lookup-failure event. Fixtures were removed, `service_role` SELECT was confirmed restored, and the dev server was stopped. T3 remains unchecked pending diagnosis of the integrated Host boundary; no implementation was modified.
  - **Root-cause diagnosis:** curl trace proved `Host: tenant-a.localhost:3000`; temporary bounded runtime instrumentation proved Next received the identical `headers.host` and sole raw Host value, `/coleccion` entered `resolveStorefrontTenant`, extraction succeeded, and normalization produced `tenant-a.localhost`. The runtime lookup returned `{ found: false, hasError: false }`, exactly like `unknown.localhost`. The smoke fixture was never inserted because its heredoc used `docker exec` without `-i`; a non-mutating probe proved piped SQL yields no output without `-i` and returns `42` with `docker exec -i`. No middleware/proxy exists, `next.config.ts` defines response headers only, and Next preserved Host. Both hosts converged on 404 because both mappings were absent; no `lookup_failed` appeared because a null row with no error is intentionally `unknown_host`, not infrastructure failure. Temporary instrumentation was removed and source restored byte-for-byte; fixture count is zero, `service_role` SELECT is restored, and port 3000 is stopped. Minimal proposed correction is test-first smoke-harness fixture verification followed by `docker exec -i` (or `psql -c`), with no product-code change.
  - **Completed smoke evidence:** fixture precondition first failed RED with `expected=2 actual=0` and confirmed Next was not started. After changing only the temporary harness to `docker exec -i`, the precondition was GREEN with 2 exact domain mappings and 2 persisted cross-wired image rows. The integrated Next 16.1.1 smoke then passed: Host A `200` with only catalog A; Host B `200` with only catalog B; unknown `404`; malformed Host `404`; Host A plus B query/body/cookie/Origin/Referer/`X-Forwarded-Host` `200` with only catalog A; induced registry permission failure `503` with `Cache-Control: no-store, must-revalidate`; restored permission returned Host A to `200`. curl traces recorded the exact direct Hosts, and prior temporary runtime evidence proved Next received them unchanged. Cross-tenant product markers and both persisted foreign image keys were absent from all opposite/conflicting responses; exposed cross-tenant image keys: 0. Exactly one bounded lookup-failure log contained only the normalized hostname. Cleanup verified zero fixture companies, restored `service_role` SELECT, stopped port 3000, and left no instrumentation. Production custom-domain Host preservation remains a release prerequisite because no deployed hosting target was available.
  - **Rollback boundary:** remove test mappings/temporary files and stop the local server; for deployed lockout, revert runtime integration while retaining registry data—never add a slug fallback.

## REFACTOR

- [x] **F1 — Remove obsolete routing code and keep one exhaustive server-only composition boundary.**
  - **Paths:** `src/lib/storefrontTenant.ts`, `src/lib/storefrontCatalog.ts`, `src/pages/coleccion/index.tsx`, and their Gate 2 tests only.
  - **Start/finish:** after all GREEN/TRIANGULATE checks pass, remove the old storefront slug resolver and duplicate normalizers, keep result unions exhaustive under strict TypeScript, keep signing validation before promise construction, and keep catalog loader inputs limited to resolved UUID plus injected client/signer. Do not refactor branding, panel/debug pages, APIs, checkout/order/payment, stock mutations, image schema, bucket policies, or unrelated configuration.
  - **Verify:** rerun the focused command `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs` and `node --test scripts/storefront-tenant-db.test.mjs`.
  - **Evidence:** both exit 0; record test counts and a source search showing collection identity no longer reads `instanceConfig.store.slug`. Runtime harness: rerun T3 A/B smoke if runtime code changed during refactor.
  - **RED baseline:** storefront unit passed 7/7 and storefront DB passed 2/2, but `pnpm exec tsc --noEmit` exited 1 with 9 diagnostics: four untyped generic-query calls, one inferred `Set<unknown>`, and four failure-union accesses without recognized narrowing. Explicit searches already found no old slug resolver or `instanceConfig.store.slug` in tenant identity surfaces and exactly one Host normalizer, one server composition, and one catalog loader.
  - **GREEN evidence:** replaced the catalog client's two existing `any` surfaces with an exact type-only `Pick` of the injected server client's `from` and `storage` capabilities; this also made product IDs and the image scope infer as `string`. Changed only the two failure checks to explicit `ok === false` discriminants. No query, branch result, scope, signing order, public function signature, or server composition changed. After query typing, TypeScript reported only the four narrowing diagnostics; after explicit narrowing, `pnpm exec tsc --noEmit` exited 0. Regression storefront unit passed 7/7, storefront DB passed 2/2, identity/structure searches passed with counts 1/1/1, and `git diff --check` exited 0. No explicit `any` remains in either affected file.
  - **T3 decision:** not repeated. The client type alias is erased at compile time, and `ok === false` is behaviorally equivalent to the prior `!ok` for the closed discriminated unions produced internally; focused orchestration, fail-closed, scoping, and image-signing regressions remained GREEN.
  - **Rollback boundary:** revert only refactor-only edits while preserving the last GREEN behavior and tests.

- [x] **F2 — Run the complete quality and commerce-integrity gate.**
  - **Paths:** verification-only across the final diff; fixes are limited to Gate 2 files named above. Any checkout/order/payment/stock failure blocks delivery and must not be “fixed” by changing those contracts within this change.
  - **Start/finish:** start from a clean local Supabase reset and finish with every command below passing in order:

    ```bash
    pnpm exec supabase db reset --local
    pnpm test:instance-config
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/storefront-tenant.test.mjs
    node --test scripts/storefront-tenant-db.test.mjs
    node --test scripts/catalog-stock-isolation-db.test.mjs
    pnpm test:buyer-checkout
    pnpm test:checkout-idempotency
    pnpm test:checkout-idempotency:db
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/order-operations-api.test.mjs scripts/order-operations-ui.test.mjs
    node --test scripts/order-operations-db.test.mjs
    pnpm lint
    pnpm exec tsc --noEmit
    pnpm build
    git diff --check
    ```

  - **Evidence:** record each exact command, exit code 0, test names/counts, and lint/typecheck/build summaries. The checkout-idempotency suites provide existing payment-attempt/Mercado Pago regression coverage; order suites provide payment-consolidation/order-state coverage. Also record final authored additions+deletions and pause for the pending delivery decision before apply.
  - **Recovered F2 run:** clean reset exited 0; instance config 6/6; storefront unit 7/7; storefront DB 2/2; Gate 1 DB isolation 1/1; buyer checkout 7/7; checkout idempotency 16/16; checkout idempotency DB 3/3; Order Operations API/UI 48/48; Order Operations DB 8/8. The first `pnpm lint` exited 1 on `scripts/bootstrap-instance.test.mjs:6:1` (`@next/next/no-assign-module-variable`). After explicit authorization, only the local `module` binding and its two `requireApi` references were renamed. The bootstrap focused test passed 5/5, lint exited 0, TypeScript exited 0, production build completed successfully, and final `git diff --check` exited 0.
  - **Final size:** including every untracked file, 2,194 additions + 258 deletions = 2,452 changed lines. Excluding harness-only `.pi/gentle-ai/sdd-preflight.json` from versioning, the Gate 2 delivery is 2,186 additions + 258 deletions = 2,444 changed lines.
  - **Runtime harness:** T3 two-host/404/503 production-equivalent smoke must also be recorded as passing; repository tests alone do not prove proxy behavior.
  - **Rollback boundary:** verification changes no behavior; revert any Gate 2-only fix that cannot pass without changing an explicit non-goal, and stop delivery rather than weakening Gate 1 or commerce integrity.
