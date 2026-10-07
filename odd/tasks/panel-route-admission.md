# Panel route admission

**Implemented, independently checked, reviewed, committed and pushed.** User authorized the slice with “dale”, resumed paused work/review, then explicitly selected local commit and “Push de ambos commits (Recomendado)”. No PR or merge was created. Gate 3 remains OPEN; Unit 3 FROZEN.

## Contract and scope

Reviewed files: `src/pages/_app.tsx`, `src/pages/panel/index.tsx`, `src/components/layout/PanelRouteGate.tsx`, `src/lib/panelRouteCapabilities.ts`, `scripts/panel-route-gate.test.mjs`. Parent bookkeeping: this document and full Engram mirror `odd/panel-route-admission/tasks`, excluded from delivery.

- Gate actual `<Component>` inside AuthProvider, before page execution; loading/denied states withhold children synchronously. Global providers and public pages are outside this guarantee.
- Exact Next pathname capabilities: `/panel` → `panel.enter`; `/panel/payments` → `payments.access`; `/panel/productos`, `/panel/productos/nuevo`, `/panel/productos/[id]`, `/panel/categorias` → `catalog.operate`; `/panel/pedidos`, `/panel/pedidos/[id]` → `orders.operate`. Unknown routes including `/panel/productos/ProductForm` deny.
- Require finished loading, own nonempty session UID, own matching profile UID/role, usable company and existing shared capability. Anonymous → login; invalid/missing identity, UID mismatch or denied route → no-authorized; otherwise-capable missing company → company registration. Loading does not redirect; malformed company denies.
- Staff can enter home/catalog/orders, not payments. Keep AuthContext, AdminLayout, Sidebar and business pages unchanged. `/panel` or `/panel/*` namespace detection is presentation, not authorization; `/panelist` public chrome is intentional.

No SQL/DB/network application requests, installs, builds, migrations, provisioning changes or Unit 3/stopped-worktree activity. Actual React SSR tests prove observed-state child non-rendering, not browser useEffect/redirect execution, hydration, auth freshness/races, API or RLS behavior.

## Completed tasks

- [x] PRA-1 — Delegated mapping; corrected boundary from nested layout to above the page.
- [x] PRA-2a — Separate diagnosis `mudjtmrl-1-ohkx`: fix Node extension callback order to `(module, filename)` while preserving real evaluation/restoration.
- [x] PRA-2 — Writer `mudjwywx-2-zow4` implemented five files; `mudkcevc-4-a3hv` corrected inherited session ID admission with Strict TDD.
- [x] PRA-3 — Independent verifier `mudk7fwv-3-ylih`, targeted recheck `mudkha9j-5-870u`, native review and exact acknowledgement completed.
- [x] PRA-4 — Evidence/limits reported; stopped before separately authorized delivery.
- [x] PRA-5 — Local commit `b908582fcad59739838098a00f4b7fca579b18be`, `fix(auth): gate panel pages by route capability`, parent `d603f314f0e92def6f1a067267ed7e502739689c`.
- [x] PRA-6 — Authorized push of this commit and products `d603f31` to `origin/gate3/pr1a-preflight-manifests-fixtures`; non-force update `a79ca9d..b908582` succeeded, upstream/HEAD divergence `0 0`, tracked worktree/index clean.

## Verification

Strict TDD from `openspec/config.yaml:4–6`. Initial loader failure was NOT RED. After repair, writer observed denied page invocation and empty staff home as natural RED. Initial GREEN 46 focused/144 combined; four test mock display-name lint errors corrected. Independent verification passed 144/144 plus tsc/lint/diff, but found inherited session ID admission. The bounded fix first failed its actual SSR case (child count 1 instead of 0), then reused own-string validation.

Final writer PASS: 47 focused, 145 combined, TypeScript, scoped ESLint and diff whitespace. Targeted independent rerun: 47/47, inherited-ID finding closed, no further concrete issue; it did not rerun the post-fix combined suite/tsc/lint. Historic RED is writer-reported.

```sh
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-route-gate.test.mjs
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test scripts/panel-route-gate.test.mjs scripts/panel-capabilities.test.mjs scripts/panel-authorization.test.mjs scripts/panel-productos-api.test.mjs scripts/order-operations-api.test.mjs
pnpm exec tsc --noEmit --incremental false
pnpm exec eslint src/pages/_app.tsx src/pages/panel/index.tsx src/components/layout/PanelRouteGate.tsx src/lib/panelRouteCapabilities.ts scripts/panel-route-gate.test.mjs
git diff --check
```

## Review and delivery evidence

ASSESS was unavailable, conservatively requiring independent checks. Native START selected medium/one `review-reliability` lens for five files, **+352/-52 =404 lines**, correction budget 200. Initial 180–300 estimate was low due to actual SSR harness/matrix; no evidence was omitted or compressed.

- Lineage `review-33472c552e466acc`; base tree `7226d93afd8055e74140422190f89b1489276b6e`.
- Approved/staged/committed tree exactly `9d009ad428feafb5d3e55519e8d415f67d7921f2`.
- Target `sha256:763298c3b77d237617860b1de9c35e67cc1f9b7f819070de57fd99ea5bbfd334`.
- One reviewer run after a forecast-only budget pause returned APPROVED. Exact acknowledgement burned authority at revision `sha256:7d4dac9432bcdfe741acb549be3c60b508ce2f0dee7a45f35f856429a543c790`.
- Non-blocking WARNING `R3-redirect-effect-coverage`, `PanelRouteGate.tsx:19–21`: client redirect-effect coverage is separate later work; receipt stands and no correction route was offered. Do not reopen/replay review.

Source SHA-256: app `3c401a134e97a777b3fc1b50d8606c09f622b83272a56b15055ffce00988bc3a`; home `c2e4a776612cc315abe42daa1ce4aba38efe53a808895771affe534f21b91d86`; gate `500e2a6f1c41f6df95ff6b40f050ebe922bac8a4077791b24d361ba7d657c863`; helper `191938d00c0a0a82684a7debde47a7c7ef1356df91e0331b86f57436efb253ed`; test `fc6beef1ac53e97cc8fd6be716b12db3d043fe01b77dbdc131cc7a380ecac2a0`.

No tests/review repeated for unchanged delivery. Historical artifacts and ODD checkpoint documents remain untracked/excluded. No PR, merge or manual deployment action; remote CI/deployment behavior was not inspected. Await next P4 or PR-planning authorization. Delivery strategy `ask-on-risk`, no chain selected; cumulative branch PR sizing is separate. Any rollback/revert requires separate approval.
