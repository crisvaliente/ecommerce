# AuthContext stale-load protection

## Authorization and scope

User accepted the two-file race-safety proposal (“si”), then explicitly selected “Incluir protección (Recomendado)” to prevent invalidated loads from starting profile inserts. Preserve active provisioning fields/fallback, canonical UID queries, roles, public context API and server authorization. Already-started inserts cannot be canceled by this guard. Strict Mode repair, error UX, redirects, SQL/DB, dependencies, builds, migrations and business features are excluded. Unit 3 FROZEN; Gate 3 OPEN. User subsequently selected “Commit local (Recomendado)”, authorizing only the exact approved two-file local commit. User then selected “Push del commit (Recomendado)”, authorizing publication of that one commit to the existing branch. No PR or merge authorized.

Baseline HEAD `b908582fcad59739838098a00f4b7fca579b18be`, branch `gate3/pr1a-preflight-manifests-fixtures`. Only source surfaces: `src/context/AuthContext.tsx` and new `scripts/auth-context.test.mjs`. This checkpoint and full Engram mirror `odd/auth-context-load-races/tasks` are excluded bookkeeping. Preserve unrelated untracked artifacts and previous burned review authorities.

## Acceptance and progress

- [x] ACR-1 — Delegated writer `muf0lpel-2-5wyz` added monotonic load ownership. Stale getSession/profile/provisioning results cannot publish state or finish current loading; logout invalidates old work without its completion erasing a newer account; unmount blocks publication. Actual-source simulated-hook harness, not copied logic. RED: old account A replaced B; GREEN 7 focused/152 combined plus tsc/lint/diff. Historic RED is writer-reported.
- [x] ACR-2a — User-authorized correction by `muf1mqvt-4-mfia`: check ownership inside ensureProfile before insert, plus final logout assertions. RED insert count `1 !== 0`; GREEN 10 focused/155 combined plus tsc/lint/diff. Logout/supersession/unmount cases prevent new stale inserts; active provisioning preserved.
- [x] ACR-2 — Independent `muf0t2iy-3-r6fh` passed initial 7/152 and tsc/lint/diff but found stale provisioning insert and missing final logout assertions. Targeted recheck `muf1rya2-5-qbj3` closed both: 10/10, diff check and actual-source probe showing zero inserts and final `{loading:false, sessionUser:null, dbUser:null}`. Corrected hashes matched. Post-correction combined 155/tsc/lint remain writer evidence; not independently rerun.
- [x] ACR-3 — After explicit resume (“retoma el laburo”), HEAD/hashes matched and the same native lineage completed all four reviewers: APPROVED, no correction. Exact native acknowledgement completed and authority burned. Checkpoint/report complete; no tests or source implementation repeated; delivery was a separate later decision.
- [x] ACR-4 — Separately authorized local commit `36755f702f3dcfc7d581536433efdec927a7b199`, `fix(auth): prevent stale profile loads and provisioning`. All source hashes and staged/committed tree matched native approval. Parent `b908582fcad59739838098a00f4b7fca579b18be`; only the two approved files committed. Tracked worktree/index clean; locally recorded upstream divergence was `0 1` at local-commit completion.
- [x] ACR-5 — Separately authorized push of `36755f702f3dcfc7d581536433efdec927a7b199` to `origin/gate3/pr1a-preflight-manifests-fixtures`. Confirmed it was the sole pending commit; non-force, no-tags push updated `b908582..36755f7`. Post-push divergence `0 0`; tracked worktree/index clean. No PR/merge.

Route: one delegated writer for two nontrivial files; independent verifier required by two unavailable native ASSESS results (`unassessable`, empty native output, writer `gpt-5.6-terra`, effort unknown). Parent performed only structural readback/Git state checks. Scope was explicitly expanded by the human after verifier evidence, not silently.

Work unit: behavior plus tests together, forecast 250–450 authored lines; actual **378 additions + 3 deletions =381** (source +17/-3, test 361 lines). Size heuristic is advisory; no compression or omission. Delivery strategy `ask-on-risk`, no chain selected; cumulative branch PR sizing remains a separate pre-delivery decision. Published work-unit commit `36755f7` contains this behavior and its tests together.

## Verification and limits

Strict TDD: `openspec/config.yaml:4–6`. No infrastructure failure counted as RED. Required writer commands all passed on corrected candidate:

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/auth-context.test.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/auth-context.test.mjs scripts/panel-route-gate.test.mjs scripts/panel-capabilities.test.mjs scripts/panel-authorization.test.mjs scripts/panel-productos-api.test.mjs scripts/order-operations-api.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/context/AuthContext.tsx scripts/auth-context.test.mjs
git diff --check
```

No browser scheduling, Strict Mode replay, live Supabase/RLS, DB behavior, or cancellation of in-flight inserts was verified. Harness transpiles actual provider source with simulated hooks/deferred Supabase mocks. Normal anonymous/profile/error results and active provisioning are covered; do not generalize to all rejected promises. No known environmental failures. Read-only initial audit `muf0ejou-1-ygbd` remains context, not deployed-schema evidence.

## Native review checkpoint

- Lineage `review-046352164bcbc0f3`: APPROVED and acknowledged; authority burned.
- HIGH (auth path), 381 original lines, correction budget 191. Lens order: `review-risk`, `review-resilience`, `review-readability`, `review-reliability`.
- Base tree `9d009ad428feafb5d3e55519e8d415f67d7921f2`; candidate tree `b73545bf33fbe07d0526cd5372333a99afd3df25`.
- Target `sha256:821434d3278afbdab0cc9f27c24966a12e8d36d6a5b199e5129c89c9bfe82eef`.
- Approved/consumed revision `sha256:54e766f5edb867a7cbc925ee5b3a065dd95091c0c5a00ee9b3344605d3caa49b`; burn evidence `gentle-ai.review-acknowledged/v1`.
- Exact candidate: tracked AuthContext and intended untracked test only; all historical/ODD artifacts excluded.
- START/consent completed before quota pause, with zero captures then. On resume: fresh same-lineage STATUS, exact full-group forecast (4 Pi host-relay model runs), forecast acknowledgement, four prepared/submitted reviewers, native APPROVED closure, fresh acknowledgement STATUS and successful acknowledgement.
- Initial acknowledgement call included controller-only input and was rejected before mutation; tool explicitly directed resubmission with lineage only, which completed. This was not a source/test failure or ambiguous replay.
- Non-blocking informational WARNINGs: `R2-module-hook-cleanup` at `scripts/auth-context.test.mjs:79–91`; `R4-signout-rejection` at `src/context/AuthContext.tsx:190`. Receipt stands; neither opened a correction. Separate later work only, never reopen this candidate.

Source SHA-256 `b9e88b42955f9efbb304267bfbe61570ff337f92ce31b30931058c9199bc1376`; test SHA-256 `c01cd2104caadcb618a20a45eea06aa455cb7f79b9fac811ddb64a9edd052540`.

The interrupted pause/file-memory gap is reconciled. Native lifecycle is over: do not issue another STATUS/acknowledgement or restart this unchanged candidate. Approval is not delivery permission. Both source/test changes are committed and pushed as `36755f7`, with staged and committed tree exactly `b73545bf33fbe07d0526cd5372333a99afd3df25`. The checkpoint and historical artifacts remain untracked/excluded. No tests or review repeated for unchanged delivery. No PR, merge or manual deployment; remote CI/deployment behavior was not inspected. Await explicit PR or next-slice authorization. No rollback or further P4 work authorized. Unit 3 remains FROZEN and Gate 3 OPEN.
