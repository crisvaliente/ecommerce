# Design

## Database boundary
An additive migration restores invoker semantics on `producto_stock_resumen`, revokes inherited/public access, and grants SELECT only to `authenticated` and `service_role`. Historical permissive SELECT policies on `producto` and `producto_variante` are replaced by one explicit authenticated policy per table keyed to `auth.uid() -> usuario.empresa_id`.

The storefront continues to use its trusted server-side service-role client. The panel continues to use an authenticated client and therefore receives only its own tenant rows through RLS.

## Storefront boundary
Tenant resolution has no visitor-input parameter. It resolves exactly one tenant by the canonical `instanceConfig.store.slug`; the name fallback is removed because slug is the configured stable identity.

## Verification
A local PostgREST regression creates two companies, two authenticated identities, and stock in each tenant. It verifies anon denial, own-tenant visibility, and empty cross-tenant filtered reads for both identities. A unit regression verifies the resolver uses only the configured slug and preserves not-found/error behavior.
