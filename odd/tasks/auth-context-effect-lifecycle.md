# AuthContext effect lifecycle

## Authorization and scope

User accepted the proposed lifecycle regression/fix with “seguimos”. Correct setup → cleanup → setup handling in AuthProvider, preserving the delivered stale-load/provisioning protections. This is a conditional effect-replay defect, not an observed production incident: next.config.ts does not explicitly enable Strict Mode and _app.tsx has no explicit wrapper. Do not enable it globally.

Baseline HEAD `36755f702f3dcfc7d581536433efdec927a7b199`, branch `gate3/pr1a-preflight-manifests-fixtures`, upstream divergence `0 0`, tracked/index clean. Preserve historical untracked artifacts and completed/burned review authorities. Unit 3 FROZEN; Gate 3 OPEN. Initial authorization excluded delivery. User subsequently explicitly selected “Commit local (recomendado)” for the two approved files only. User later separately selected “Push del commit (recomendado)” for that commit on the existing remote branch. PR, SQL/DB, app/browser runtime, dependency installation, build, migration, provisioning redesign, permission change and new error UX remain unauthorized.

Allowed writer edit surfaces:
- `src/context/AuthContext.tsx`
- `scripts/auth-context.test.mjs`

Parent-owned checkpoint and full Engram mirror `odd/auth-context-effect-lifecycle/tasks` are excluded bookkeeping; worker must not edit them.

## Acceptance

1. Replaying actual provider effect setup/cleanup/setup can finish the current session/profile load and leaves exactly one active auth subscription. No didInit suppression or permanently false mounted flag.
2. Cleanup unsubscribes and invalidates the previous lifetime. Restoring a live mounted flag must not let earlier pending session/profile/provisioning work publish state, finish current loading, or start an obsolete insert.
3. Final unmount leaves no active subscription and old work cannot publish state or start new inserts. Already-started writes remain outside cancellation guarantees.
4. Preserve public context API, canonical UID lookup, profile creation fields/fallback, logout/refresh/new-account behavior and existing ten AuthContext regressions. Do not address unrelated logout-rejection or loader-cleanup advisories in this slice.
5. Tests evaluate actual provider source. Extend the existing deterministic simulated-hook harness to exercise lifecycle callbacks and track active subscriptions/cleanup; do not copy production logic. Explicitly distinguish callback-order unit proof from real React/browser Strict Mode behavior. No DOM dependency or browser test claim.

## Tasks and routing

- [x] EFL-1 — Writer `mufx22dp-1-16xf` completed tests/fix. Natural RED on original provider: expected one active subscription after replay, got zero. GREEN: 12 focused/157 combined, TypeScript, scoped lint and diff check PASS. Extracted stable invalidateLoad after an ESLint warning; final check clean. Historic RED is writer-reported. Route: delegated, two nontrivial files plus preparation.
- [x] EFL-2a — Writer `mufxdvwb-3-odyv` added 11 test lines: settle stale getSession after current replay load, drain continuation, assert current identity/profile/loading/single subscription before final unmount. Source hash unchanged. Initial GREEN expected for test-only strengthening, no fabricated RED. Focused 12/12, combined 157/157, scoped lint/diff PASS; TypeScript not repeated.
- [x] EFL-2 — Initial independent verifier `mufx961g-2-3e61` passed all five commands (12/157/tsc/lint/diff), finding only the unresolved-staleSession coverage gap. Targeted recheck `mufxigx2-4-rc1k` closed it: 12/12 and diff check PASS; HEAD, both hashes and two-file scope matched. Combined/tsc/lint not rerun in targeted recheck. Both ASSESS calls were unassessable/native empty output; independent verification requirement satisfied.
- [x] EFL-3 — Native review `review-0049235012d3f0db` approved after all four reviewer results were admitted. Exact acknowledgement completed and authority burned. No correction was required; delivery was deferred for separate authorization.
- [x] EFL-4 — User explicitly authorized local commit only. Staged and committed trees exactly matched the approved tree. Created `30d7aaacd898105ff8ec59597c934eed35ba28f5`; tracked/index clean, upstream comparison `1 0` against the local tracking ref. Unrelated untracked artifacts preserved; no push or PR during EFL-4.
- [x] EFL-5 — User separately authorized push of `30d7aaa`. Non-force, no-tags push advanced `origin/gate3/pr1a-preflight-manifests-fixtures` from `36755f7` to `30d7aaa`. Post-push local upstream comparison `0 0`; tracked/index clean, unrelated untracked artifacts preserved. No PR or merge.

One coherent work unit with code and tests; forecast 80–220 authored added/deleted lines; actual +96/-15 =111 (test +87/-1; source +9/-14). Count is advisory: no minification, missing tests or forced abstractions to fit. Delivery strategy `ask-on-risk`, no chain selected; accumulated branch PR scope is a separate decision before future authorized delivery. Work-unit commit: `30d7aaacd898105ff8ec59597c934eed35ba28f5` (`fix(auth): restore provider lifecycle after effect replay`).

## Verification

Strict TDD ON from refreshed `openspec/config.yaml:4–6`. Task-scoped Node runner follows existing scripts; infrastructure/harness failure is not RED. Observe a behavioral replay failure (subscription missing, loading stuck or old lifetime publishing) before source fix. Writer runs these commands synchronously and reports exact results:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/auth-context.test.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/auth-context.test.mjs scripts/panel-route-gate.test.mjs scripts/panel-capabilities.test.mjs scripts/panel-authorization.test.mjs scripts/panel-productos-api.test.mjs scripts/order-operations-api.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/context/AuthContext.tsx scripts/auth-context.test.mjs
git diff --check
```

No known environmental failures established. Unexpected failing required command means partial. Never execute DB suites from global config. All Supabase interactions must be deterministic in-memory mocks. Parent follows ASSESS/native outcome for verification routing; failed assessment is unassessable, never low risk.

## Current evidence and next step

Baseline defect: mountedRef was not rearmed after cleanup and didInit suppressed replacement subscription. Writer now starts mountedRef false, rearms on setup, invalidates load ownership and unsubscribes on cleanup, removing didInit/separate cleanup effect. Tests add explicit effect replay/subscription count tracking and current-load/stale-provisioning cases. All five required commands passed in both writer and independent verifier reports (12 focused/157 combined). Implementation verified; test-coverage strengthening closed by targeted independent recheck `mufxigx2-4-rc1k`. Harness remains callback-order simulation, not actual React/browser StrictMode proof.

Parent confirmed HEAD `36755f702f3dcfc7d581536433efdec927a7b199`, exactly two tracked changes, unrelated untracked artifacts preserved. Candidate SHA-256: source `d258159a44a52c116a028a08814e05bc29fe6349ffebb124b2e77dbe00a68061`; test `cf2beafb90c263fc14de47f07563b9c0d97335dc595a4e781aa169ffafe50c5e` after test-only strengthening.

Independent verifier `mufx961g-2-3e61` found no source failure, but the original first replay test never settled its staleSession. Parent elected to close that small gap within already-authorized lifetime acceptance: same test file only, explicitly resolve the old session after replay, drain pending work, and assert current identity/profile/loading/subscription state. Existing source must remain byte-identical. This is test-only strengthening expected to pass the correct implementation; historical lifecycle RED stays as recorded, no synthetic RED required.

The test-only strengthening, targeted independent recheck and native review are complete. Final 157-test rerun/lint are writer evidence; focused 12/diff are also independently rechecked; TypeScript remains the prior independent result on byte-identical production source. No tests were rerun during review resumption.

## Native review closure

Resumed the existing review rather than creating another lineage. Fresh bound STATUS confirmed the same two-file candidate; unrelated untracked artifacts remained excluded. The previously forecast group ran four models via `pi_host_relay`, in provider order: review-risk, review-resilience, review-readability, review-reliability. All four results were admitted; native closure was approved without a correction round.

- Lineage: `review-0049235012d3f0db`.
- Tier: high (authentication); original changed lines: 111; frozen logical correction budget: 56, unused.
- Base tree: `b73545bf33fbe07d0526cd5372333a99afd3df25`.
- Approved candidate tree: `b06db7e338d17888daffed64dcd1a2ca86db3317`.
- Target identity: `sha256:13036f22f625f240308fab9057e5c9672b758a82400eb35c5de9815ca349cd5e`.
- Consumed revision: `sha256:4fdb3ef1a9419ff1d0e5a4ffa9665c126308923420636d04e407d83ead792919`.
- Exact acknowledgement returned `native-approved-acknowledgement-completed`, authority `burned`, evidence `gentle-ai.review-acknowledged/v1`. No STATUS or replay after burn.

## Authorized local delivery

After review closure, user explicitly selected local commit only. Confirmed baseline HEAD, branch, empty index, both expected SHA-256 values and two-file scope. Staged only `src/context/AuthContext.tsx` and `scripts/auth-context.test.mjs`. Both staged tree and resulting commit tree equal approved `b06db7e338d17888daffed64dcd1a2ca86db3317`.

Commit: `30d7aaacd898105ff8ec59597c934eed35ba28f5` — `fix(auth): restore provider lifecycle after effect replay`. Post-commit tracked/index state is clean; unrelated untracked artifacts remain untouched. Local upstream comparison is `1 0`; no fetch or push was performed. Prior passing test evidence applies to the identical tree; tests were not rerun for delivery, and burned review was not reopened.

## Authorized publication

User separately selected “Push del commit (recomendado)”. Confirmed the current branch, approved commit/tree, clean tracked/index state and exactly one outgoing commit. Ran `git push --no-follow-tags origin 30d7aaacd898105ff8ec59597c934eed35ba28f5:refs/heads/gate3/pr1a-preflight-manifests-fixtures` without force. Push succeeded (`36755f7..30d7aaa`), with post-push local upstream comparison `0 0`. Untracked artifacts were preserved. Tests were not rerun; the exact verified/reviewed commit was published. Remote CI/deployment status was not inspected.

Next: user decision on the next bounded slice. No PR, merge, SQL/DB or application/browser run occurred. Gate 3 remains OPEN; Unit 3 remains FROZEN; overall P4 is not complete.
