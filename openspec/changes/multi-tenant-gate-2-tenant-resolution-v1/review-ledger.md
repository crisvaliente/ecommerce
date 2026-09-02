# Review Ledger — Multi-Tenant Gate 2

| id | lens | location | severity | status | evidence |
|---|---|---|---|---|---|
| R1-001 | risk | `design.md:184-205,296-310` | BLOCKER | verified | Initial review and refutation confirmed that scoped `producto_id` alone did not bind `path`/`url_imagen` to the resolved company/product before service-role signing. The corrected design now requires canonical key validation against resolved `empresaId` and scoped `producto_id`, rejects conflicting or legacy ambiguous paths, omits invalid rows before signing, and requires bidirectional cross-wired-object tests. Fresh scoped re-review verified the correction against actual upload conventions and policies. |
| R3-001 | reliability | `tasks.md:106-110` | BLOCKER | open | T3 was checked without persisted local HTTP or production proxy evidence. Fresh refutation confirmed only runbook commands exist. |
| R3-002 | reliability | `tasks.md:26-103` | CRITICAL | open | R1–R4, G1–G4, T1, and T2 were checked without `apply-progress.md` or recorded command/exit/test evidence after the interrupted apply. Fresh refutation confirmed the evidence gap. |
| R3-003 | reliability | `scripts/storefront-tenant-db.test.mjs:38-108` | CRITICAL | open | T2 lacks real DB bootstrap collision/idempotency coverage, foreign-only image-null behavior, conflicting-input behavior, and recorded Gate 1 execution. Fresh refutation confirmed the omissions. |
| R3-004 | reliability | `scripts/storefront-tenant.test.mjs:155-209` | WARNING | info | T1 does not fully assert malformed/unknown/failure mapping and catalog call counts. |
| R3-005 | reliability | `src/lib/storefrontCatalog.ts:69-74` | WARNING | info | Image key validation accepts filename segments `.` and `..`; path-traversal rejection coverage only exercises `../x`. |
| R3-006 | reliability | `scripts/bootstrap-instance.test.mjs:20-61` | WARNING | info | Bootstrap tests do not assert sanitized JSON hostname/state output wiring. |
| R3-007 | reliability | `tsconfig.json:10`; `.pi/gentle-ai/sdd-preflight.json` | WARNING | info | Gate 2 includes a project-wide TS import-policy change and untracked harness state; both require scope justification or removal. |
