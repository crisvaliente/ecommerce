# Explicit profile status in AuthContext (slice A)

## Intent and authorization

User accepted option 2 of the resume survey ("dale"): an explicit profile-error state for AuthContext consumers plus a short backoff before the single retry. This closes the deferred review findings R2-ambiguous-null-profile and R4-immediate-retry from `auth-profile-provisioning.md`.

Split into two slices to keep review small:

- **Slice A (this doc):** `src/context/AuthContext.tsx` and `scripts/auth-context.test.mjs` only. Additive for consumers.
- **Slice B (not started):** panel admission shows a retryable "profile could not be loaded" state for `profileStatus === "error"` instead of redirecting to `/auth/no-autorizado`.

No SQL, DB, other UI/API, commit, push or PR authorized. Baseline HEAD `db0abfb`, branch `gate3/pr1a-preflight-manifests-fixtures`, in sync with origin.

## Contract

- `profileStatus: "loading" | "anonymous" | "ready" | "missing" | "error"` is the single source of load state; `loading` is derived as `profileStatus === "loading"` (same public field, no duplicated state).
- `anonymous`: no session, or after `signOut`. `ready`: own profile found. `missing`: lookup succeeded without a row (console.warn). `error`: lookup and its retry both failed (console.error twice).
- A lookup error waits `PROFILE_RETRY_DELAY_MS` (500 ms) before the single retry. The load-version guard is checked after the wait, so logout/new account/unmount during the backoff cancels the retry lookup.
- Existing replay, stale-load, logout and unmount protections are unchanged.

## Tasks

- [x] PS-1 — RED: 7 new tests (backoff timing, logout during backoff, 5 status cases); retry tests use `node:test` mock timers for `setTimeout`. Harness `state` getter now reads the status slot. Observed 9 failures: backoff (2), missing `profileStatus` (5), harness getter reading the old boolean slot (2). `withConsole` now only records `[auth]` logs, because Node prints the MockTimers ExperimentalWarning through `console.error`.
- [x] PS-2 — GREEN: `profileStatus` state replaces `loading` state; `wait()` + guard before the retry.
- [x] PS-3 — Checks: focused 21/21; combined panel suite 184/184 (auth-context, panel-shell, panel-route-gate, panel-capabilities, panel-authorization, panel-productos-api, panel-categorias-api, panel-categorias-ui, order-operations-api); `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0. Mutation check: removing the post-backoff guard fails only "logout during the backoff delay cancels the retry lookup"; file restored byte-identical. Diff +155/−16 = 171 lines, 2 files.
- [x] PS-4 — Native review `review-7554097781e777d3` (high, 4 lenses, 171 lines, correction budget 86). risk: 0 findings. resilience: 0 findings. readability: WARNING R2-dead-harness-getter, WARNING R2-console-filter-scope, SUGGESTION R2-duplicated-retry-delay, SUGGESTION R2-implicit-mock-timer-precondition. `review-reliability` refused again ("prompt injection", 5th time overall); payload preserved under `.git/gentle-ai/rejected-results/`. No BLOCKER/CRITICAL; no verdict possible.
- [x] PS-5 — User chose to fix the 4 test-only findings. Removed the unused harness getter; `withConsole` now drops only the MockTimers ExperimentalWarning; the test delay constant names `PROFILE_RETRY_DELAY_MS` as its origin; `loadSingleAccount` states its mock-timer precondition. Checks: focused 21/21 (also without `--disable-warning`), combined 184/184, tsc/ESLint/diff-check exit 0. Divergence check: production delay 250 ms fails 1 test and 1000 ms fails 7 tests; file restored byte-identical. Diff vs HEAD +157/−16, 2 files. The review lineage is stale for this candidate.
- [x] PS-6 — User said "dale": commit `90bf572` `fix(auth): expose explicit profile status and back off the profile retry` with only the 2 files (+157/−16). Pushed `db0abfb..90bf572` to `origin/gate3/pr1a-preflight-manifests-fixtures` (no force, tags or PR). This task doc stays untracked.

## Limits

Mocked hooks, Supabase client and timers; not proof of real browser scheduling. No consumer reads `profileStatus` yet, so user-visible behavior is unchanged until slice B. `src/components/ProtectedRoute.tsx` has no importers (dead code, out of scope).
