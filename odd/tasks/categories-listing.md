# Canonical panel category listing

## Intent and authorization

User accepted the proposed first categories slice with “dale seguimos”: move category LISTING behind canonical panel authorization and adapt its current page, with focused tests. Create/update/delete remain unchanged for a separately authorized later slice. This does not prove or repair deployed RLS and does not close category CRUD or Gate 3.

Baseline HEAD `f6813935821453b3d722336ddbe4da2e8fdf2833`, branch `gate3/pr1a-preflight-manifests-fixtures`; tracked/index clean, local upstream comparison `0 0`. Preserve unrelated untracked artifacts and stopped worktrees. Unit 3 FROZEN; Gate 3 OPEN; previous review authorities burned and not reopened.

Allowed writer edits:
- `src/pages/api/panel/categorias.ts` (new)
- `src/pages/panel/categorias/index.tsx`
- `scripts/panel-categorias-api.test.mjs` (new)
- `scripts/panel-categorias-ui.test.mjs` (new)

Parent owns this document and full mirror `odd/categories-listing/tasks`. No commit, push, PR, merge, database/SQL, migration, schema/RLS modification, dependency installation, build, application/browser/network run, AuthContext/shell/global-gate edits or new permissions authorized.

## Existing evidence and design boundary

Current categories page lists `categoria` directly through browser Supabase with `dbUser.empresa_id`; inserts also use browser company, while updates/deletes filter by category ID. The latter mutation paths are outside this slice and remain an explicit residual boundary, not implicitly secured by the new list endpoint. Existing products API uses `authorizePanelRequest(req, "catalog.operate")`, then `createPanelServiceClient()` and `principal.empresaId`; follow that pattern without changing its helpers or tolerant stock behavior.

API contract:
1. New GET `/api/panel/categorias`, returning `{ items }` with only current category fields: `id`, `nombre`, `slug`, `descripcion`, `orden`. Preserve `.order("orden", { ascending: true, nullsFirst: true })` and empty-list behavior; no pagination or sorting redesign.
2. Enforce GET-only with Allow/405, then existing rate-limit helper pattern (dedicated `api:panel:categorias:list`, 60 per 60 seconds), reject own query `empresa_id` with `400 legacy_tenant_input`, then canonical `catalog.operate` authorization. Propagate canonical authorization error/status; do not construct authority from client company, role, email or cookie manually.
3. Only after successful authorization create the service client and query `categoria` with `.eq("empresa_id", authorization.principal.empresaId)`. No unscoped query, browser tenant fallback or success fallback after database failure. Restrict response fields; no company metadata needed.
4. Successful response is no-store; preserve useful bounded error logging without credentials/raw internal response leakage. Query errors/unexpected exceptions become `500 internal_error`; do not change shared error policy or helpers.

UI acceptance:
1. Replace only listing transport with authenticated same-origin API request, following current products-page bearer-session convention. Never send `empresa_id` in URL/body/header as listing authority; browser company may remain a reload trigger and input to existing out-of-scope mutations.
2. Preserve category form, mutation functions/payloads, labels, rendering, ordering, existing loading/error presentation and post-mutation refresh through the listing function. Keep browser Supabase import if still needed for existing mutations/auth; do not remove or redesign them.
3. Tests prove the page listing calls the new API rather than browser category SELECT, handles failed responses without falling back to direct reads, and preserves refresh behavior. Guard any new asynchronous session/request ordering introduced by this change proportionately; do not change AuthContext or start a general race audit.
4. Server/API tests cover no-session/denied canonical results, exact capability request, canonical company A/B filtering, forged client company rejection, method/rate precedence, empty/data/error results. Mock database/network boundaries; do not copy authorization business logic into fixtures as production behavior.

## Tasks and routing

- [x] CL-0 — Read-only diagnosis `muko2vhb-1-6q0l` found the partial API/listing implementation within scope and identified missing `useCallback`/`useRef` in the UI React mock. No tests or commands ran; failure cause/history remain unknown. Existing mutation paths remain present; exact preservation still needs diff verification. Safe to resume original writer without rollback.
- [x] CL-1 — Original-writer continuation `mukoaqj2-2-c811` completed. Recovered writer-reported behavioral RED before implementation; repaired UI mock and expanded API/UI tests. All eight current checks reported successful (no-index exit 1 with no diagnostics). Parent matched all final hashes and confirmed mutation functions/payloads/filters have no diff hunks. Independent verification remains separate.
- [x] CL-2 — Independent verifier `mukoi7mk-3-daaz` returned PASS: all eight checks repeated, 13 focused/175 combined tests passed, hashes matched, scope/mutations preserved, no actionable defects. ASSESS was unavailable; independent verification satisfied its fail-closed plan.
- [ ] CL-3 — Native review STARTED after user "si" (2026-09-28): lineage `review-391944401244b9eb`, medium tier, lens `review-reliability`, 520 lines, exact 4 paths (3 intended untracked). Candidate hashes matched checkpoint. Both acknowledged reviewer captures were refused at admission: the relay reviewer model called its own prompt "prompt injection" and returned prose, not JSON (rejected payloads under `.git/gentle-ai/rejected-results/review-391944401244b9eb/`). The slot was not consumed and the lineage is still `reviewing` with no verdict. User chose a manual read-only review instead: no blocking findings, only low nits (sticky errorMsg on later success, empty-state text shown next to the error, UI test couples to useState order, missing UI tests for no-session and error-state assertions). The manual review does NOT close the native review and does not authorize delivery. User then said "commit": verified hashes, 13/13 focused tests passed, local commit `8cc58fa` created with only the 4 paths (+502/-18). User then said "dale pushea": pushed `f681393..8cc58fa` to `origin/gate3/pr1a-preflight-manifests-fixtures` (no force, tags or PR). Branch is in sync with origin.

Forecast was 280–440 authored added/deleted lines; interrupted partial count was 447. Parent-confirmed final candidate: +502/-18 = 520 (page +58/-18, new API 85, API test 172, UI test 187). Do not compress or remove coverage to shrink it. One honest slicing pass offered API + API tests = 257 and dependent UI + UI tests = 263. User explicitly chose “aceptar exepcion y pausar por aca porque estamos cerca del limite de hrs”: `size:exception` accepted for this coherent 520-line listing unit, no chain selected. This is NOT provider review consent, an approved review, or permission to create branches/commits/push/PRs. Pause immediately after recording the checkpoint. Counts constrain slicing, not code quality. Any expanded scope or accumulated branch/PR size remains a separate decision. Delivery strategy remains `ask-on-risk`; no commit yet.

## Verification

Strict TDD ON, refreshed from `openspec/config.yaml:4–6`. Existing Node actual-source TypeScript-transpilation tests provide the runner; presence of tests alone is not the configuration source. Bootstrap new imports minimally if needed, then observe behavioral RED (authorization/tenant/listing contract), not a missing file, import error or harness failure. Preserve historical evidence explicitly, then GREEN and refactor/rerun.

Writer runs synchronously:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-categorias-api.test.mjs scripts/panel-categorias-ui.test.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-categorias-api.test.mjs scripts/panel-categorias-ui.test.mjs scripts/panel-shell.test.mjs scripts/auth-context.test.mjs scripts/panel-route-gate.test.mjs scripts/panel-capabilities.test.mjs scripts/panel-authorization.test.mjs scripts/panel-productos-api.test.mjs scripts/order-operations-api.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/pages/api/panel/categorias.ts src/pages/panel/categorias/index.tsx scripts/panel-categorias-api.test.mjs scripts/panel-categorias-ui.test.mjs
git diff --check
git diff --no-index --check /dev/null src/pages/api/panel/categorias.ts
git diff --no-index --check /dev/null scripts/panel-categorias-api.test.mjs
git diff --no-index --check /dev/null scripts/panel-categorias-ui.test.mjs
```

Report exact exit/output for no-index checks (ordinary differences may yield 1; whitespace diagnostics are failures). No known environmental failures. Unexpected failing required check means partial. No DB suites from global config. No installs or external requests; deterministic mocked dependencies only. Include all three new files in line counts and eventual intended-untracked review selection, excluding every unrelated artifact. Simulated hooks/manual callbacks prove only their tested ordering, not real browser scheduling or deployed tenant isolation.

## Progress

Worker `muk3174t-1-2yi0` failed with only `assistant reported an error`; result lookup exposed no useful retained report. User resumed with “seguimos”. Parent reconciled this checkpoint with full mirror and confirmed unchanged baseline HEAD/branch, empty index, one modified authorized page and all three authorized new files; unrelated untracked artifacts preserved. No RED/GREEN or passed-check claim can be inferred from file presence.

Pre-diagnosis SHA-256:
- API: `3b6d88f1914666fc1cf19d52d69263e9a6c7aa40312d53c0f715d42980d4ae12`.
- Page: `c77decc488a467fbb68d4043b8811e825f5deaf17a42b0dc09c71f2c860fb0cf`.
- API test: `66a0e5ce8a54afa82d003095d0265b1e2587e1c786a92a50a74ac4ce021e4ead`.
- UI test: `95cc1a87ac871e01618b4bebed672d488cebcd623b37f7622c94d08a1a22442a`.

Read-only diagnosis `muko2vhb-1-6q0l` inspected the four files, products API, canonical authorization helper and strict-TDD config. It observed the intended GET/rate/tenant-input/auth/company-filter/field/order/no-store/error contract; page bearer fetch without tenant input or direct SELECT fallback; `listingRequestId` ordering protection; and existing mutation paths still present. It did not run commands or establish historical execution evidence.

Concrete static harness defect: UI React mock omits `useCallback` and `useRef` used by the page. Correct the harness in its authorized test file before relying on any test output. API denial tests simulate canonical resolver results; an explicit credentialless-request case and honest distinction from actual credential-parser coverage are needed, without changing shared auth logic or adding runtime/DB tests.

Continuation `mukoaqj2-2-c811` recovered writer-reported historical RED: focused command exit 1 before behavior implementation, API `501 !== 200` / `501 !== 405`, UI no canonical fetch. Parent did not independently observe that historical run; this is explicitly recovered writer evidence, not a new rollback/run. Harness defects are recorded separately, not counted as behavioral RED. Writer repaired hook mocks/restored globals and added credentialless delegation, failed-fetch/no-fallback, mutation refresh and stale-session ordering cases; production hashes are unchanged from the interrupted candidate.

Writer current evidence: focused 13/13 and combined 175/175 (exit 0); TypeScript, scoped ESLint and tracked diff-check exit 0 with no output; each of three no-index checks exit 1 with empty stdout/stderr, no whitespace diagnostics. Model/effort not observable. Mocked canonical denial is delegation coverage, not parser execution; manual hooks/callbacks are not browser scheduling or deployed RLS proof.

Parent fresh Git reconciliation: HEAD unchanged, index empty, only authorized tracked page modified plus the three authorized new files; unrelated artifacts preserved. Page diff ends in listing code; mutation functions/payloads/filters have no hunks. All final hashes match writer:
- API `3b6d88f1914666fc1cf19d52d69263e9a6c7aa40312d53c0f715d42980d4ae12`.
- Page `c77decc488a467fbb68d4043b8811e825f5deaf17a42b0dc09c71f2c860fb0cf`.
- API test `48375c8adb329c35ebfc28a5318a58136a5eed785d18f003e20ab828ed527fa8`.
- UI test `b4fe9720b075a0a49bfd58730e6e21a09aedd0f3d5fa63827f13a578d4d1aba2`.

ASSESS returned `native review assess failed: native command returned empty output`, risk unassessable, independentVerifier true. Its zero changedPaths/changedLines are not an empty-diff claim.

Independent verification `mukoi7mk-3-daaz` PASS: repeated all eight commands. Focused 13/13 and combined 175/175 exit 0; TypeScript, scoped ESLint and tracked diff-check exit 0 with no output; all three no-index checks exit 1 with empty stdout/stderr, ordinary differences and no whitespace diagnostics. Verified API precedence/tenant filtering/fields/order/no-store/errors, authenticated same-origin listing without tenant input/direct SELECT, unchanged mutations and matching final hashes/HEAD/index. No actionable defects; mocked authorization and manual-hook/browser/RLS limits remain explicit.

User accepted the 520-line size exception and requested a pause due to the hours limit. No native review INSPECT/START was performed for this candidate and no lineage exists; do not treat size acceptance as provider consent. No commit/push/PR/delivery action. Next authorized session: reconcile this exact candidate and complete CL-3 native review under fresh actual authority/consent, report, then stop before separately authorized delivery. Create/update/delete remain unchanged and outside this slice. Unit 3 FROZEN; Gate 3 OPEN.
