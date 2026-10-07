# Capability-driven panel shell

## Intent and authorization

User accepted the proposed AdminLayout/Sidebar consistency slice with “buenaso,seguimos entonces”. Reuse existing canonical route-admission policy in the shell and navigation; remove independent role allowlists without changing permissions. This is policy-duplication cleanup and defensive rendering, not a demonstrated bypass of the existing above-page PanelRouteGate.

Baseline: `30d7aaacd898105ff8ec59597c934eed35ba28f5`, branch `gate3/pr1a-preflight-manifests-fixtures`, tracked/index clean, local upstream comparison `0 0`. Prior EFL review is acknowledged/burned; never reopen it. Preserve unrelated untracked artifacts and stopped worktrees. Unit 3 FROZEN; Gate 3 OPEN; P4 not complete.

Authorized source/test edits only:
- `src/components/layout/AdminLayout.tsx`
- `src/components/layout/panel/Sidebar.tsx`
- `scripts/panel-shell.test.mjs` (new focused test)

Parent owns this checkpoint and full Engram mirror `odd/panel-shell-capabilities/tasks`. Initial implementation authorization excluded delivery. User subsequently explicitly selected “Commit local (recomendado)” for the three approved files. User later separately selected “Push del commit (recomendado)” for that commit on the existing remote branch. PR, merge, SQL/DB, migration, dependency installation, build, application/browser run, permission change, categories work and profile provisioning change remain unauthorized.

## Design boundary and acceptance

1. Reuse existing exports from `src/lib/panelRouteCapabilities.ts` (`decidePanelAdmission`, `panelCapabilityForPathname`) as appropriate. Do not introduce another route map, capability table, role allowlist, permissive default, new requiredCapability prop, or modify canonical policy merely to make tests pass.
2. AdminLayout consumes current pathname and AuthContext snapshot. Only allow renders protected shell/children; loading and redirect decisions withhold them synchronously. Preserve existing interstitial text and redirect destinations. Keep side effects out of render. Reuse the decision rather than recoding UID/role/company checks.
3. Sidebar link visibility follows admission for each existing link destination using the same session/profile/loading snapshot. Preserve link labels, order, URLs, active-link presentation and footer; no new UI or navigation item.
4. Staff can access panel/catalog/orders but not payments; admin can access payments. Cliente, missing/malformed/mismatched profile identity and loading must not render protected layout content or navigation links. Unknown layout routes deny rather than defaulting to panel.enter. Preserve existing login/no-authorization/company redirects.
5. Existing global PanelRouteGate stays above page execution and unchanged. Do not claim layout gating alone prevents parent page hooks. AuthContext and API/RLS boundaries remain unchanged.
6. Focused tests exercise actual component source with real admission policy and mocked AuthContext/router/dependencies. Assert observable rendered content/link parity and, if feasible with the existing harness, redirect destinations. Do not copy authorization logic into tests or use source-text checks as the primary proof. State explicitly which effects/runtime behaviors were not exercised; no browser/React scheduling integration claim.

## Tasks and routing

- [x] PSC-0 — Read-only diagnosis `mujdyivi-1-gjqq` found the partial edits within scope and using real canonical policy. No tests executed; root cause/history of the worker failure remain unknown. Parent reconfirmed HEAD/index/scope and captured hashes. Resume is safe without rollback; this is not implementation approval.
- [x] PSC-1 — Original writer continuation `muje2666-2-crz7` completed source/tests, recovered historical behavioral RED from its retained session, removed nested loader use and added manual redirect-effect assertions. Reported focused 5/5, combined 162/162, TypeScript, lint and tracked whitespace PASS. Untracked whitespace command reported empty output/exit 1; PSC-2 independently confirmed ordinary no-index difference status, not a whitespace diagnostic. No production rollback or manufactured RED. Multi-file writer route; discovery by `muio6v96-1-5h9t` and parent three-file readback.
- [x] PSC-2 — Independent verifier `muje85a2-3-q363` PASS: focused 5/5, combined 162/162, TypeScript, scoped lint, tracked whitespace and untracked whitespace checks. All three hashes and 273-line scope match. No blocker; missing direct positive AdminLayout assertion is a non-blocking coverage gap. ASSESS was unassessable, so independent verification fulfilled its fallback plan.
- [x] PSC-3 — Native review `review-15a3fb1553c5b3b9` approved through one provider-selected consolidated review; acknowledgement completed and authority burned. Exactly three files included, only the shell test selected as intended untracked. No correction round or delivery action during review.
- [x] PSC-4 — User separately authorized local commit only. Created `f6813935821453b3d722336ddbe4da2e8fdf2833` with exactly the two components and test. Staged and committed trees match the approved tree; tracked/index clean; local upstream comparison `1 0`. No push during PSC-4.
- [x] PSC-5 — User separately authorized publication of `f681393`. Non-force, no-tags push advanced `origin/gate3/pr1a-preflight-manifests-fixtures` from `30d7aaa` to `f681393`. Post-push local upstream comparison `0 0`; tracked/index clean, unrelated untracked artifacts preserved. No PR or merge.

One coherent source+test work unit. Forecast 160–320; current count 273 authored lines (tracked +25/-52, new test 196), independently counted by parent. Writer's phrase “32 added” was inconsistent with its total; Git confirms +25. Counts are advisory only; no minification, packed tests or omitted coverage to fit. Delivery strategy `ask-on-risk`, no PR chain selected; accumulated branch delivery scope is separate from this candidate. Work-unit commit: `f6813935821453b3d722336ddbe4da2e8fdf2833` (`fix(auth): align panel shell with canonical admission`). Further delivery requires separate authorization.

## Verification

Strict TDD ON from `openspec/config.yaml:4–6`, refreshed before delegation. Follow existing actual-source Node test patterns in `scripts/panel-route-gate.test.mjs` and `scripts/auth-context.test.mjs`; no new dependencies. Natural RED must demonstrate incorrect admission/rendering or navigation on original components, not missing imports or mock/harness failure. Preserve the existing role semantics even where valid-user link sets already match.

Writer runs synchronously:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-shell.test.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-shell.test.mjs scripts/auth-context.test.mjs scripts/panel-route-gate.test.mjs scripts/panel-capabilities.test.mjs scripts/panel-authorization.test.mjs scripts/panel-productos-api.test.mjs scripts/order-operations-api.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/components/layout/AdminLayout.tsx src/components/layout/panel/Sidebar.tsx scripts/panel-shell.test.mjs
git diff --check
git diff --no-index --check /dev/null scripts/panel-shell.test.mjs
```

No known environmental failures established. Do not run global DB commands from OpenSpec config. Report unexpected failures as partial; do not expand scope to fix unrelated issues. Include new untracked test in authored line count and later review intended-untracked selection; exclude all unrelated untracked paths.

## Evidence and next step

Parent confirmed baseline state and existing exports. Scout recommendation for a new requiredCapability prop is not adopted: existing route admission already supplies the decision and avoids a second configurable boundary.

Initial worker `muioeclg-2-mv0h` failed with only `assistant reported an error`; source changes and a 150-line test remained. User resumed; separate read-only diagnosis found scope intact but could not establish execution evidence. Parent captured Git state/hashes independently. No edits were discarded. Original-session continuation `muje2666-2-crz7` recovered historical RED: original components rendered `Protected child` for cliente/unknown route and exposed links for invalid snapshots. This is writer-reported historical evidence, not an independently replayed RED.

Continuation kept both component hashes unchanged, expanded the test to 196 lines, removed nested module-loader calls and added manually executed redirect assertions. Parent read the final test and confirmed scope, count, empty index and baseline HEAD. Writer reported all checks passing, with empty output/exit 1 for the no-index whitespace command; verifier must report observed output/status rather than assume its meaning. No known test failure currently reported.

Current SHA-256:
- AdminLayout: `134d5a579d5464a398ad39afb4f4caea03ecdff41a1de472f89cb73879654295`.
- Sidebar: `c7e520019afa849eabe8929bc8fa5c92879493da9f6e97c19d6c2ae2a2aaa0bf`.
- Test: `e3ff5c9c018e6aa423e59e8b2d882c3b227fd3b0039edabad7e316a7dbb27fd0`.

Fresh ASSESS with nativeReviewOutcome unknown returned unassessable/native empty output and required independent verification (writer model/effort unavailable, fail-closed small profile). Its empty candidate counters are not the actual diff count. Independent verifier `muje85a2-3-q363` has now passed the exact six commands: focused 5/5, combined 162/162, tsc/lint/tracked whitespace exit 0; untracked no-index check emitted no diagnostics and exit 1 (ordinary differing-file status). Source reuse, synchronous withholding, redirect effect placement, unchanged canonical policy/global gate and all hashes match. No implementation blocker found.

The missing direct positive AdminLayout render assertion remains a non-blocking coverage gap, not a demonstrated failure; positive sidebar behavior is covered. SSR/manual effect coverage does not prove browser scheduling. Native review of this exact three-file candidate is now approved and acknowledged; only `scripts/panel-shell.test.mjs` was included as intended untracked. The coverage gap stays recorded; it does not reopen the closed review.

## Native review closure

First consent expired before an answer; native explicitly returned no invocation, no mutation and no lineage created. Fresh INSPECT reselected the exact same test and candidate; a fresh START completed consent and created the review. No reset/recovery, stale binding reuse or alternate candidate was used.

- Lineage: `review-15a3fb1553c5b3b9`.
- Tier: medium; one consolidated `review-reliability` model run through `pi_host_relay`.
- Original changed lines: 273; frozen logical correction budget: 137, unused.
- Base tree: `b06db7e338d17888daffed64dcd1a2ca86db3317`.
- Approved candidate tree: `3733a22cf82f4a665bbfe6dd881ee7af873fd795`.
- Target identity: `sha256:a236615e665d67206b4e7497a806a0ef753872bafccfd35fb9b73e02aec409c3`.
- Consumed revision: `sha256:29bbe3a3fef55f72579f4b5a014f3023d121a6d43d91ab2b036bd6fa347d4b72`.
- Exact acknowledgement: `native-approved-acknowledgement-completed`, authority `burned`, evidence `gentle-ai.review-acknowledged/v1`. No status/replay after burn.

## Authorized local delivery

User separately selected local commit only. Before staging, parent confirmed baseline HEAD, current branch, empty index, exactly two tracked component edits and the new test, and all three approved hashes. Staged only those three files. Staged tree and resulting commit tree both equal approved `3733a22cf82f4a665bbfe6dd881ee7af873fd795`.

Commit: `f6813935821453b3d722336ddbe4da2e8fdf2833` — `fix(auth): align panel shell with canonical admission`; 3 files, +221/-52. Post-commit tracked/index state is clean; unrelated untracked artifacts remain untouched. Local upstream comparison is `1 0`, without a fetch. Existing passing evidence applies to the identical approved tree; tests were not rerun and burned review was not reopened.

## Authorized publication

User separately selected “Push del commit (recomendado)”. Confirmed the existing branch/upstream, approved commit/tree, clean tracked/index state and exactly one outgoing commit. Ran `git push --no-follow-tags origin f6813935821453b3d722336ddbe4da2e8fdf2833:refs/heads/gate3/pr1a-preflight-manifests-fixtures` without force. Push succeeded (`30d7aaa..f681393`); post-push local upstream comparison `0 0`. Unrelated untracked artifacts remain untouched. Tests were not rerun; the exact verified/reviewed commit was published. Remote CI/deployment status was not inspected.

Next: user decision on the next bounded slice. No PR, merge, DB/SQL, application/browser or manual deployment action occurred. Unit 3 remains FROZEN; Gate 3 remains OPEN; overall P4 is not complete.
