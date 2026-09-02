# Explore — Multi-Tenant Gate 2: Tenant Resolution v1

## Objective and constraints

Introduce one server-side, authoritative `host/domain -> empresa` resolver for the public storefront. Gate 2 must prove that two mapped hosts resolve to two different tenants, that malformed/unknown hosts execute no tenant catalog reads, and that visitor query/body values cannot override storefront read tenancy.

This is a new Gate 2 change. Gate 1 remains the database isolation baseline and must not be repurposed. This phase changes no product code, tests, migrations, configuration, or other OpenSpec artifacts.

## Current state

### Company and tenancy model

- `public.empresa` is defined in `supabase/migrations/20251218031035_remote_schema.sql` with `id`, `nombre`, `descripcion`, nullable globally unique `slug`, owner/creator legacy fields, and timestamps. It has no hostname/domain field or related domain table.
- Operational tenancy is `public.usuario.empresa_id`, not the older `public.membresia` authority (`20260801120000_security_tenancy_hardening.sql`).
- The server-side storefront client in `src/lib/supabaseServer.ts` uses the service-role key and bypasses RLS. Every storefront query therefore must carry the resolved `empresa_id`; RLS is not a fallback for a missing server filter.
- Gate 1 (`openspec/changes/multi-tenant-gate-1-isolation-hardening/`) restored `security_invoker=true` on `producto_stock_resumen`, denied anonymous catalog/stock reads, constrained authenticated product/variant reads to `usuario.empresa_id`, and retained trusted service-role access.
- Gate 1's resolver (`src/lib/storefrontTenant.ts`) accepts only the build-time canonical slug. Its tests prove configured-slug-only resolution and fail-closed not-found/error behavior, but not host parsing or multi-host behavior.

### Build-time instance contract

`instance.config.json` describes one canonical deployment/store (`raeyz`) and is imported at module/build time by `src/config/instance.ts`. Current dependencies are:

| Consumer | Dependency | Gate 2 disposition |
| --- | --- | --- |
| `src/pages/coleccion/index.tsx` | Store slug selects `empresa`; store name/logo render catalog/cart | Replace slug-based **identity** with host resolver. Keep name/logo temporarily; dynamic branding is out of scope. |
| `src/pages/_app.tsx` | Title, description, favicon | Temporary compatibility; full dynamic config is out of scope. |
| `src/pages/_document.tsx` | HTML locale | Temporary compatibility. |
| `src/lib/formatters.ts` | Locale and UYU currency | Temporary compatibility; multiple currencies are excluded. |
| `src/lib/supabaseClient.ts` | Auth storage namespace | Keep; this is technical instance configuration, not tenant selection. Browser storage is also origin-scoped. |
| `src/components/common/Header.tsx`, `Footer.tsx` | Public brand assets/text | Temporary compatibility. |
| `src/components/ui/RayzSection.tsx`, `ProductCard.tsx` | Public brand assets/text | Temporary compatibility. |
| `src/components/layout/AdminLayout.tsx`, `layout/panel/Sidebar.tsx` | Panel brand label | Out of public resolver scope. |
| `scripts/bootstrap-instance.mjs` | Resolve/create canonical company by slug, seed it, namespace deterministic IDs | Keep only as provisioning compatibility; it is a suitable place to register the canonical `APP_BASE_URL` hostname after the domain source exists. |
| `next.config.ts`, auth/payment URL helpers | `APP_BASE_URL`, not store slug | Keep. OAuth, origin allowlist, webhook and payment return URLs remain one-instance concerns in this gate. |

Thus Gate 2 should remove only the identity dependency from the catalog read path, not attempt a branding/config migration.

## Public read and identity map

### Storefront commerce reads

The only current SSR commerce read surface is `src/pages/coleccion/index.tsx` (`getServerSideProps`):

1. derives `empresaId` from `instanceConfig.store.slug -> public.empresa.id`;
2. reads published `producto` with an explicit `.eq("empresa_id", empresaId)`;
3. reads `producto_stock_resumen` with the same explicit company filter;
4. reads `producto_variante` by product IDs, but without an additional explicit `empresa_id` filter;
5. reads `imagen_producto` by the already tenant-filtered product IDs (the image table has no `empresa_id` column), then signs private storage paths;
6. sends the resolved company ID into the cart.

The first product query is the scope anchor for later ID-based reads. Gate 2 should additionally filter variants by resolved `empresa_id` as cheap defense in depth. Images can only be anchored through scoped product IDs under the current schema; adding `empresa_id` to images is not part of this gate.

`src/pages/index.tsx` has no database reads. Its content, plus shared header/footer/head, remains build-time branded.

### Other public/authenticated reads and boundaries

- `AuthContext` reads `usuario` by authenticated Supabase UID; panel authorization derives company from that profile. Neither accepts storefront company identity and neither should switch to host tenancy.
- `GET /api/ecommerce/mi-cuenta/direccion` scopes by authenticated user.
- `GET /api/ecommerce/pedido/[id]` scopes by authenticated database user and order ownership, then by the order's stored `empresa_id`.
- `POST /api/ecommerce/pedido` accepts `empresa_id` in the checkout body. The trusted service-role RPC validates every product/variant against that company and preserves idempotency; it is a mutation contract, not a storefront read selector.
- `POST /api/ecommerce/intento-pago` derives the order through authenticated ownership/RPC behavior. Payment remains platform-wide in this gate.
- Panel APIs either derive company from authorization or compare a requested company to the authenticated profile. They are not host-resolved.
- `src/pages/post.tsx` and debug pages contain unrelated/unscoped prototype diagnostics; `nuevo-favorito.tsx` contains a client write. They are not current storefront catalog surfaces, but production exposure should be handled separately rather than absorbed into Gate 2.

Checkout/order/payment contracts should remain unchanged in Gate 2. A visitor can forge a checkout body, but cannot mix products across companies because `crear_pedido_con_items` checks product and variant ownership; order reads require buyer ownership. Binding checkout mutations to request host would be a separate contract change and should not be smuggled into this gate.

## Request host trust analysis

The repository has no `vercel.json`, reverse-proxy configuration, middleware, Docker ingress, or code reading `Host`/`X-Forwarded-Host`. The documented deployment signal is one `APP_BASE_URL`; `apiSecurity.ts` trusts `Origin`/`Referer` only for CSRF-style API checks and uses forwarding headers only for rate-limit IPs.

For Pages Router SSR, `context.req.headers.host` is the available request authority. It is visitor-influenced input, but safe as a selector only after strict normalization and an exact lookup in the authoritative domain allowlist. It must never be treated as an authorization claim by itself.

Recommended v1 source precedence:

1. use exactly one `Host` value from the Next.js/Node request;
2. do **not** use `Origin`, `Referer`, URL query values, cookies, or request body to select the storefront tenant;
3. do **not** honor `X-Forwarded-Host` until the deployed proxy trust boundary is explicitly configured and regression-tested. Accepting it now would let a client-controlled forwarding header override `Host` in runtimes that do not sanitize it.

Deployment validation is required before release: confirm the actual hosting platform preserves the incoming custom domain in `Host`. Preview/platform hostnames will intentionally fail closed unless explicitly registered.

## Recommended minimum contract

### Explicit source of truth

Add a small `public.empresa_dominio` table rather than overloading `empresa.slug` or adding one domain column:

- `hostname text primary key` — globally unique, normalized, port-free lookup key;
- `empresa_id uuid not null references public.empresa(id) on delete cascade`;
- `created_at timestamptz not null default now()`;
- normalization check(s), plus an index on `empresa_id`.

This permits necessary aliases without introducing routing rules, wildcard domains, onboarding, status workflows, branding, or a domain-management UI. Removing a row disables that host. Enable RLS and revoke access from `public`, `anon`, and `authenticated`; grant only the minimum service-role access needed by server resolution/provisioning. The public must not enumerate tenant mappings.

Do not make `empresa.slug` a hostname. Slugs are existing company/provisioning identifiers and may not be DNS names.

### Normalization

Use one pure server-compatible normalizer before every lookup and when provisioning mappings:

- require one non-empty string with no surrounding/internal whitespace, control characters, commas, scheme, path, query, fragment, or userinfo;
- accept a valid local port and remove it (`localhost:3000 -> localhost`); reject invalid/out-of-range ports;
- lowercase DNS casing;
- normalize one terminal DNS dot consistently (recommended: remove it);
- enforce total/label length and DNS label syntax after normalization;
- support `localhost` and loopback IP literals only as explicit local mappings; do not silently map all local hosts to the canonical company;
- either convert international names to ASCII/Punycode through one well-tested path or reject non-ASCII in v1. The smaller v1 contract is normalized ASCII only.

Examples:

| Input | Result |
| --- | --- |
| `Shop-A.Example.com` | `shop-a.example.com` |
| `shop-a.example.com:443` | `shop-a.example.com` |
| `localhost:3000` | `localhost` |
| `shop-a.example.com.` | `shop-a.example.com` |
| `https://shop-a.example.com`, `a.example,b.example`, `user@host`, malformed port/label | invalid, no lookup |

### Resolver API and failure behavior

Evolve `src/lib/storefrontTenant.ts` toward a result such as:

```ts
type StorefrontTenantResolution =
  | { ok: true; tenant: { empresaId: string; hostname: string } }
  | { ok: false; reason: "invalid_host" | "unknown_host" | "lookup_failed" };
```

The authoritative resolver should accept only the raw request host plus an injected lookup boundary for testability. The page must not accept an `empresa_id`, tenant slug, or domain from `context.query`.

- malformed/missing host: no database lookup and no catalog reads;
- unknown host: one mapping lookup, then no catalog reads;
- lookup/database failure: no catalog reads;
- known host: return exactly one company ID and use it on all tenant-bearing catalog/stock reads.

Unknown/malformed hosts should return a generic 404. A backend lookup failure may return a generic unavailable response/503, but must not fall back to `instance.config.store.slug`. Log a bounded reason and normalized host where safe; never log secrets or emit whether another query-supplied tenant exists.

### Local development and rollout

- Continue using `APP_BASE_URL=http://localhost:3000` locally.
- Extend provisioning/bootstrap to register the normalized `APP_BASE_URL` hostname for the canonical slug-resolved company. On collision with another company, fail instead of reassigning.
- For the two-host demonstration, use explicit test mappings such as `tenant-a.localhost` and `tenant-b.localhost` (or fixture `.test` hosts). Do not add a magic `?empresa_id=` or hostname-to-slug convention.
- Rollout order is migration -> register at least the canonical production/local hostname -> deploy host-based code. A runtime slug fallback would hide missing/colliding mappings and weaken the source-of-truth claim, so it is not recommended even temporarily.

The remaining `instance.config` branding, locale/currency, auth namespace, bootstrap slug, and `APP_BASE_URL` payment/OAuth behavior are the explicit temporary compatibility boundary.

## Verification strategy for a later implementation

Strict TDD should cover:

1. unit table tests for casing, ports, trailing dot, local hosts, malformed/multiple header values, schemes/userinfo, missing host, and unknown/error fail-closed behavior;
2. a query-parameter attack regression showing `?empresa_id=<other>` (and slug/domain variants) never reaches the resolver input and cannot alter the selected tenant;
3. a database-backed two-company/two-domain fixture proving host A resolves only company A and host B only company B, duplicate hostname assignment is rejected, and mapping rows are not readable by anon/authenticated roles;
4. storefront catalog assertions in both A->B and B->A directions with distinct products/stock, proving all service-role reads are filtered by the resolved company;
5. preservation of Gate 1 catalog/stock PostgREST regressions, checkout/idempotency suites, Order Operations suites, lint, TypeScript, and build.

The two directions need distinct fixture values to avoid false positives. Unknown and malformed host tests should assert that the catalog lookup callbacks were never called.

## Likely implementation surface and workload forecast

Likely files (exact naming may change during proposal/design):

- new additive `supabase/migrations/*_multi_tenant_gate_2_tenant_domains.sql`;
- `src/lib/storefrontTenant.ts`;
- `src/pages/coleccion/index.tsx`;
- `scripts/storefront-tenant.test.mjs`;
- likely a new `scripts/storefront-tenant-db.test.mjs` or expansion of the Gate 1 DB fixture without changing Gate 1's artifact identity;
- `scripts/bootstrap-instance.mjs` for canonical hostname registration;
- `package.json`, `README.md`, and possibly `local-env.sample` for commands/rollout documentation.

Estimated changed lines:

| Work unit | Estimate |
| --- | ---: |
| Domain table, privileges, invariants | 60–100 |
| Host normalization/resolver and unit tests | 170–260 |
| SSR catalog integration and scoped query adjustments | 25–60 |
| Two-host DB/catalog regression | 150–240 |
| Bootstrap and operational docs/scripts | 70–130 |
| **Total** | **475–790** |

This likely exceeds the 400 changed-line review budget. With `chained_pr_strategy: ask-always`, planning should prepare reviewable work units (for example, domain contract/resolver first, storefront integration/proof second) but must ask for a delivery decision before apply; do not assume a chained PR strategy.

## Risks and decision points

- **Proxy ambiguity:** current repo-local evidence does not establish a trusted `X-Forwarded-Host` contract. Using it without deployment confirmation is the largest routing risk.
- **Service-role blast radius:** a missed `empresa_id` filter leaks across tenants despite Gate 1 RLS. Keep resolution and read composition close and test both directions.
- **Operational lockout:** deploying before registering the canonical hostname will correctly make the storefront unavailable. Rollout ordering and collision checks are mandatory.
- **Partial visual tenancy:** two hosts can show different catalogs while still sharing Raeyz branding/locale/currency. This is intentional temporary compatibility and must be stated plainly.
- **Checkout host binding:** checkout still carries cart `empresa_id` and relies on transactional validation, not host binding. Changing that now would expand scope and payment/order risk.
- **Preview/local aliases:** unregistered preview, `127.0.0.1`, IPv6, or alternate local names fail closed. Teams must register each intended hostname explicitly.
- **Legacy company policies:** `empresa` has accumulated historical SELECT policies/grants. The new domain mapping should be private independently rather than relying on those legacy policies.

## Recommended next phase

Proceed to an SDD proposal for this exact Gate 2 change, using the domain table + strict `Host` normalization + service-side resolver as the minimum contract. Proposal questions should settle the production host/proxy contract, canonical hostname provisioning/rollout, ASCII-only domain policy, and expected 404 versus 503 behavior before design/apply.
