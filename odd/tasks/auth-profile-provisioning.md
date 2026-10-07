# Remove browser profile provisioning from AuthContext

## Intent and authorization

User chose option 1 ("vamos por las opcion 1 loco") from the read-only Gate 3 survey: remove browser-side `usuario` creation/repair from `AuthContext`. This closes the rebaseline P4 item "browser cannot repair profile". Scope: `src/context/AuthContext.tsx` and `scripts/auth-context.test.mjs` only. No SQL, DB, migration, other UI/API, commit, push or PR authorized. Gate 3 OPEN; Unit 3 FROZEN.

Baseline HEAD `b39399e`, branch `gate3/pr1a-preflight-manifests-fixtures`, in sync with origin, index empty.

## Evidence

- `a79ca9d` migration `20260914165851_panel_identity_catalog_isolation.sql` revokes all on `public.usuario` from `authenticated` and grants only SELECT (`usuario_select_self`). The browser insert could therefore only fail and fall back to a second lookup.
- Trigger `on_auth_user_created` → `public.handle_new_auth_user()` creates the `cliente`/null-company/onboarding profile in the same transaction as the auth user, with UID/email conflict checks.
- Not verified: whether that migration is applied in the real Supabase environment.

## Contract

- `load()` performs exactly one own-profile lookup by `supabase_uid`.
- A missing profile or a returned lookup error publishes `dbUser = null` and `loading = false`; nothing is written from the browser and there is no second lookup.
- Existing load-version, replay, logout and unmount protections are unchanged.

## Tasks

- [x] APR-1 — RED: replaced the tests pinning the browser insert payload and the three insert-race tests (whose code path no longer exists) with two contract tests (missing / errored lookup). Observed a natural behavioral RED against the old code: both failed on `inserts` containing the browser `usuario` row; the other 8 tests passed. The replay race test was reworded to a stale missing-profile result that cannot clear the current account.
- [x] APR-2 — GREEN: removed `ensureProfile` (insert + fallback lookup). `load` maps error/missing to `null`.
- [x] APR-3 — Checks (parent, 2026-09-28): focused 10/10; combined panel suite 173/173 (auth-context, panel-shell, panel-route-gate, panel-capabilities, panel-authorization, panel-productos-api, panel-categorias-api, panel-categorias-ui, order-operations-api); `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0 with no output. Diff +30/−167 = 197 lines across 2 files.
- [x] APR-4 — Native review `review-c7fd4d091d4f3e8f` (high, 4 lenses, 197 lines). Admitted: risk no findings. Resilience: WARNING trigger dependency without fallback/backfill/deploy order; WARNING transient error indistinguishable from a missing profile, retry lost (the base re-selected inside ensureProfile). Readability: WARNING ambiguous null profile + console.debug only; SUGGESTION name the trigger/migration. `review-reliability` refused twice ("prompt injection" prose, same as CL-3); retries stopped, no verdict.
- [x] APR-5 — User chose "Corregir y volver a verificar". RED: 3 new tests failed naturally (only one lookup made); the missing-profile/no-retry test already passed. GREEN: `fetchOwnProfile` helper; a lookup **error** is retried exactly once and logged with `console.error`; a missing profile is never retried; `isCurrentLoad` is checked after each lookup; the comment names `on_auth_user_created` / `20260914165851`. Checks: focused 12/12, combined 175/175, tsc/ESLint/diff-check exit 0. Diff vs HEAD +100/−160 = 260 lines, 2 files. The earlier review lineage is now stale for this candidate.
- [x] APR-6 — Second native review `review-83a84420bd685469` (high, 260 lines). risk 0 findings; resilience WARNING silent missing profile + SUGGESTION immediate retry; readability WARNING ambiguous null (deferred) + SUGGESTION retry invalidation coverage. `review-reliability` refused twice more (4 total); its unofficial prose review was positive and raised only trigger timing (the trigger is synchronous, same transaction). No HIGH/BLOCKER; no verdict possible.
- [x] APR-7 — User approved a small correction. RED: missing-profile warning test failed (0 warnings). New logout/unmount pending-retry tests passed already. Mutation check (guard after the retry temporarily removed, file restored byte-identical): the superseded and logout tests failed, so they guard `isCurrentLoad`. The unmount test still passed because `safeSet`/`mountedRef` blocks it independently. GREEN: `console.warn` when a lookup returns no error and no profile. Checks: focused 14/14, combined 177/177, tsc/ESLint/diff-check exit 0. Diff vs HEAD +145/−155 = 300 lines, 2 files.
- [x] APR-8 — User chose "Commit y push": commit `948f8f5` `fix(auth): stop provisioning profiles from the browser` with only the 2 files (+145/−155). Pushed `b39399e..948f8f5` to `origin/gate3/pr1a-preflight-manifests-fixtures` (no force, tags or PR). This task doc stays untracked.

Deferred debt: explicit profile-error state for consumers, plus a short backoff before the retry (R2-ambiguous-null-profile, R4-immediate-retry); DB check that the migration is applied and no auth user lacks a `usuario` row (backfill). Tooling: the `review-reliability` relay lens refuses consistently, so native reviews cannot reach a verdict.

Deferred: an explicit profile-error state for consumers (touches every AuthContext consumer); deploy order/backfill check (migration applied + no auth user without a `usuario` row) needs DB access.

## Limits

Mocked hooks and Supabase client; this is not proof of real browser scheduling or deployed RLS. A user whose trigger-created profile is missing now gets no profile (and is denied by panel admission) instead of a browser-created one. Before, that browser insert was already denied by the reviewed migration.
