# Handle thrown Supabase calls in AuthContext load

## Intent and authorization

User accepted the recommended next slice ("dale"): `load()` had no try/catch, so a thrown `getSession` or profile lookup became an unhandled rejection (on mount and on the panel Reintentar button) and never reached the profile-error state from `90bf572`/`0cc801f`. Scope: `src/context/AuthContext.tsx` and `scripts/auth-context.test.mjs` only. No SQL, DB, other UI/API, commit, push or PR authorized. Baseline HEAD `fe50d15`, in sync with origin.

## Contract

- A thrown `getSession` is handled like a returned session error: `console.debug`, no session, `profileStatus: "anonymous"` (same as the existing "returned getSession errors clear both users" behavior).
- A thrown profile lookup is handled like a returned lookup error: `console.error`, one retry after the backoff, then `ready` or `error`.
- `load()` / `refresh()` never reject. Load-version, logout and unmount guards are unchanged.

## Tasks

- [x] LE-1 — RED: 3 tests (thrown getSession on refresh, thrown lookup then recovery, lookup and retry both thrown on refresh). All 3 failed naturally with the thrown error ("storage unavailable" / "network down"). Thrown fixtures create the rejection on access so it is never unhandled before the provider awaits it.
- [x] LE-2 — GREEN: `readSessionUser()` and `fetchOwnProfile()` wrap their Supabase calls in try/catch and return `{ …, error }`; `load()` consumes them unchanged in shape. The `data as CustomUser` cast moved into `fetchOwnProfile`.
- [x] LE-3 — Harness timing: the async wrappers add one microtask hop, so two race tests ("an old profile completion leaves the current load pending", "logout invalidates pending work…") no longer reached the profile stage before their auth event/logout, and the queued lookups were consumed by the wrong load. Added `flush()` plus explicit `queriedUids` assertions to pin the intended ordering instead of counting microtasks. The adjusted tests pass against both HEAD `AuthContext.tsx` (only the 3 new tests fail) and the candidate; the file was restored byte-identical after the HEAD run.
- [x] LE-4 — Checks: focused 24/24, combined panel suite 190/190, `pnpm exec tsc --noEmit --incremental false`, scoped ESLint and `git diff --check` exit 0. Diff +90/−12 = 102 lines, 2 files.

## Limits

Mocked hooks, Supabase client and timers. A thrown `getSession` is treated as "no session", so the panel redirects to login rather than offering Reintentar; that matches the existing returned-error behavior and was kept deliberately.
