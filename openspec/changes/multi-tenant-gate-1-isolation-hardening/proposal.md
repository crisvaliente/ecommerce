# Multi-Tenant Gate 1 — Isolation Hardening

## Problem
`producto_stock_resumen` lost `security_invoker` when it was recreated, and the storefront accepts a visitor-controlled `empresa_id` query parameter. Together these allow tenant selection or stock reads outside the canonical deployment tenant.

## Outcome
Public catalog and stock surfaces cannot select another tenant from visitor input. The current deployment remains single-store and resolves its tenant only from `instance.config.json`.

## Scope
- Restore invoker security and least-privilege grants for the stock view.
- Canonicalize source-table SELECT RLS for authenticated tenant users.
- Remove visitor-controlled storefront tenant selection.
- Add two-tenant PostgREST regressions for anon and authenticated roles.
- Preserve storefront, panel, checkout, and Order Operations contracts.

## Non-goals
- Tenant-by-host resolution.
- Dynamic tenant configuration.
- Tenant-specific Mercado Pago configuration.
- Checkout or Order Operations API contract changes.
