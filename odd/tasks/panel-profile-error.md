# Retryable panel state for profile lookup errors (slice B)

## Intent and authorization

User accepted the recommended order ("dale como vos recomendaste"): docs commit for slice A (`563194f`), then slice B. Slice B consumes `profileStatus` from `90bf572`: a failed own-profile lookup shows a retryable state in the panel instead of redirecting to `/auth/no-autorizado`.

Scope: `src/lib/panelRouteCapabilities.ts`, `src/components/layout/PanelRouteGate.tsx`, `src/components/layout/AdminLayout.tsx`, `scripts/panel-route-gate.test.mjs`, `scripts/panel-shell.test.mjs`. No SQL, DB, API, commit, push or PR authorized. Baseline HEAD `563194f`, in sync with origin.

## Contract

- `decidePanelAdmission` accepts an optional `profileStatus`. With a valid session UID and `profileStatus === "error"` it returns `{ kind: "profile-error" }`, which never admits.
- Precedence is unchanged: `loading`, then no session → `/auth/login`, then malformed session → no-autorizado, then profile error. A missing profile (`"missing"`) still redirects to `/auth/no-autorizado`. Callers that omit `profileStatus` (Sidebar) keep the previous behavior; Sidebar shows no links in either case.
- `PanelRouteGate` renders `role="alert"`, "No pudimos cargar tu perfil…" and a **Reintentar** button calling `refresh()`. No redirect.
- `AdminLayout` now fails closed on every non-`allow` outcome. Before, any kind other than `loading`/`redirect` rendered the panel.

## Tasks

- [x] PB-1 — RED: 3 route-gate tests (profile-error decision, precedence guard, gate markup + retry click) and one AdminLayout denial case. Natural RED in 2: the decision returned the no-autorizado redirect and the gate rendered "Verificando acceso…". The precedence and AdminLayout cases passed already and act as guards.
- [x] PB-2 — GREEN: the changes above.
- [x] PB-3 — Checks: combined panel suite 187/187 (auth-context, panel-shell, panel-route-gate, panel-capabilities, panel-authorization, panel-productos-api, panel-categorias-api, panel-categorias-ui, order-operations-api); `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0. Mutations: removing AdminLayout's fail-closed branch fails "withholds the protected layout for denied admissions"; moving the profile-error check before the session checks fails the precedence test. Both files restored byte-identical. Diff +99/−2 = 101 lines, 5 files.
- [x] PB-4 — Native review `review-ba421f353bda00b8` (medium tier, only `review-reliability`, 101 lines, budget 51). The lens refused as "prompt injection" (6th time overall); no verdict. Manual review of the diff found no blockers. Notes: AdminLayout's generic non-allow branch shows the profile-specific message, but today only `profile-error` reaches it (defense in depth behind the gate). Repeated retry clicks are safe because each refresh supersedes the previous load. Pre-existing and out of scope: `load()` has no try/catch, so a thrown `getSession`/lookup becomes an unhandled rejection (both on mount and on Reintentar).

## Limits

SSR render and direct component calls with mocked router/auth; not proof of a real browser click. The retry re-runs the whole `load()`, so the gate briefly shows "Verificando acceso…" before the new result. There is no retry limit or sign-out action on the error screen.
