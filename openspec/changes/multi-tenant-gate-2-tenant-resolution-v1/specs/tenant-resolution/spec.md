# Tenant Resolution Specification

## Purpose

Define authoritative, fail-closed host-based tenant selection and isolation for public storefront reads while preserving existing database, checkout, order, payment, and instance-wide compatibility contracts.

## Requirements

### Requirement: Private authoritative domain ownership

The system MUST use one private domain registry as the sole runtime source of truth for mapping a normalized hostname to a company. Each registered hostname MUST be globally unique and MUST reference exactly one extant company; a hostname is active only while that valid mapping exists. Removing a mapping MUST disable that hostname, and public, anonymous, and authenticated consumers MUST NOT be able to enumerate the registry.

#### Scenario: One hostname has one owner

- GIVEN a normalized hostname is registered to one extant company
- WHEN another company attempts to register the same hostname
- THEN the registration MUST fail
- AND the existing ownership MUST remain unchanged

#### Scenario: Mapping is removed

- GIVEN a hostname has an active mapping
- WHEN that mapping is removed or its referenced company is deleted
- THEN the hostname MUST no longer resolve to a company

#### Scenario: Untrusted role attempts enumeration

- GIVEN a public, anonymous, or authenticated consumer
- WHEN it attempts to enumerate domain mappings
- THEN the system MUST deny access to the registry

### Requirement: Strict direct Host authority

The system MUST derive storefront tenancy exclusively from exactly one direct Node/Next `Host` header value. It MUST NOT use `X-Forwarded-Host`, `Origin`, `Referer`, URL or query values, request bodies, cookies, or any other header as a tenant selector.

#### Scenario: Direct Host selects the tenant

- GIVEN a request has one valid direct `Host` value mapped to company A
- AND alternate request inputs identify company B
- WHEN storefront tenancy is resolved
- THEN company A MUST be selected
- AND every alternate tenant identifier MUST be ineffective

#### Scenario: Forwarded authority disagrees

- GIVEN the direct `Host` maps to company A
- AND `X-Forwarded-Host`, `Origin`, or `Referer` identifies company B
- WHEN storefront tenancy is resolved
- THEN company A MUST be selected

### Requirement: Deterministic ASCII host normalization

The system MUST accept only a single, syntactically valid ASCII hostname authority. It MUST lowercase the hostname, remove a syntactically valid decimal port, and remove exactly one terminal DNS dot before lookup. A supplied port MUST be an integer from 1 through 65535. The normalized DNS hostname MUST be no longer than 253 characters; every label MUST contain 1 through 63 ASCII letters, digits, or hyphens and MUST NOT begin or end with a hyphen. `localhost` MUST be accepted by this syntax, but it and every other local or loopback name MUST resolve only through an explicit mapping.

The system MUST reject missing, empty, array-valued, repeated, or comma-combined Host input; whitespace or control characters; non-ASCII characters; schemes, paths, queries, fragments, userinfo; malformed labels; invalid, empty, or ambiguous ports; and more than one terminal dot. It MUST NOT trim or repair invalid input, perform internationalized-domain or Punycode conversion, or infer a canonical tenant for a local hostname.

#### Scenario: Case, port, and terminal dot normalize consistently

- GIVEN the sole Host value is `SHOP.EXAMPLE.COM.:443`
- WHEN it is normalized
- THEN the normalized hostname MUST be `shop.example.com`

#### Scenario: Explicit localhost mapping

- GIVEN the sole Host value is `localhost:3000`
- WHEN it is normalized
- THEN the normalized hostname MUST be `localhost`
- AND it MUST select a company only if `localhost` is explicitly registered

#### Scenario: Multiple or malformed authority is rejected

- GIVEN Host input is missing, repeated, array-valued, comma-combined, contains forbidden syntax, or has an invalid port
- WHEN it is normalized
- THEN normalization MUST return an invalid-host outcome
- AND the system MUST NOT choose any company

#### Scenario: Non-ASCII hostname is rejected

- GIVEN the Host contains any non-ASCII character
- WHEN it is normalized
- THEN normalization MUST return an invalid-host outcome
- AND the system MUST NOT convert the value to Punycode

### Requirement: Fail-closed resolution outcomes

The resolver MUST distinguish known, invalid, unknown, and lookup-failure outcomes internally and MUST fail closed for every outcome other than known. Invalid input MUST cause no mapping, catalog, variant, image, or stock lookup. An unknown normalized hostname MUST cause at most its mapping lookup and no storefront data lookup. A mapping infrastructure failure MUST cause no storefront data lookup and MUST NOT fall back to a configured slug or any canonical company. Invalid and unknown hosts MUST produce a generic not-found response; lookup infrastructure failures MUST produce a generic unavailable response and bounded server-side diagnostics.

Diagnostics MAY include a bounded failure reason and a safe normalized hostname, but MUST NOT include secrets or visitor-supplied alternate tenant identifiers.

#### Scenario: Invalid host skips all reads

- GIVEN Host input is invalid
- WHEN tenant resolution runs
- THEN no domain mapping lookup MUST occur
- AND no catalog, variant, image, or stock read MUST occur
- AND the response MUST be generic not-found

#### Scenario: Unknown host reads only the registry

- GIVEN a valid normalized hostname has no active mapping
- WHEN tenant resolution runs
- THEN no catalog, variant, image, or stock read MUST occur
- AND the response MUST be generic not-found

#### Scenario: Registry lookup fails

- GIVEN the domain registry lookup fails
- WHEN tenant resolution runs
- THEN no catalog, variant, image, or stock read MUST occur
- AND no configured slug or canonical company MUST be selected
- AND the response MUST be generic unavailable

### Requirement: Host-derived scoping for every storefront read

Every public tenant-bearing storefront read MUST be explicitly scoped to the company resolved from Host. This includes product, variant, and stock reads, regardless of whether privileged server credentials bypass row-level security. Image reads MUST be reachable only through product identifiers already scoped to that company and MUST NOT broaden tenant selection. No public storefront read MAY derive or override company scope from query, body, cookie, header, URL, slug, or instance configuration input.

#### Scenario: Override inputs are ineffective

- GIVEN Host resolves to company A
- AND query, body, cookie, or header inputs contain company B's ID, slug, or domain
- WHEN the storefront composes its catalog
- THEN every tenant-bearing read MUST remain scoped to company A
- AND no data belonging only to company B MUST be returned

#### Scenario: Images follow scoped products

- GIVEN Host resolves to company A
- WHEN product images are read
- THEN image eligibility MUST originate only from product identifiers already scoped to company A

### Requirement: Bidirectional catalog and stock isolation

For two distinct hosts mapped to two distinct companies, each host MUST expose only its mapped company's products, variants, and stock. Isolation MUST hold in both directions, including when the companies have deliberately distinct catalog and stock fixtures.

#### Scenario: Host A cannot read company B data

- GIVEN host A maps to company A and host B maps to company B
- WHEN the storefront is requested through host A
- THEN it MUST return only company A's products, variants, and stock
- AND it MUST NOT return data belonging only to company B

#### Scenario: Host B cannot read company A data

- GIVEN host A maps to company A and host B maps to company B
- WHEN the storefront is requested through host B
- THEN it MUST return only company B's products, variants, and stock
- AND it MUST NOT return data belonging only to company A

### Requirement: Collision-safe provisioning

Canonical provisioning MUST normalize the hostname from configured `APP_BASE_URL` under the same host policy and MUST register it for the intended company before host-based routing is enabled. Repeating provisioning for the same hostname and company MUST be idempotent. A hostname already owned by another company MUST cause an explicit failure and MUST NOT be reassigned. Production, local, preview, alias, and health-check hostnames MUST each be explicitly registered if they are intended to serve the storefront.

#### Scenario: Provisioning repeats safely

- GIVEN the normalized `APP_BASE_URL` hostname is already registered to the intended company
- WHEN canonical provisioning runs again
- THEN it MUST succeed without creating a duplicate or changing ownership

#### Scenario: Provisioning detects a collision

- GIVEN the normalized `APP_BASE_URL` hostname belongs to another company
- WHEN canonical provisioning runs
- THEN it MUST fail explicitly
- AND it MUST preserve the existing mapping

### Requirement: Migration-first rollout and compatible rollback

The additive private domain registry and all intended mappings MUST exist and be verified before host-based storefront resolution is enabled. Runtime rollback MAY restore the prior runtime integration while retaining the additive registry, but it MUST NOT weaken existing database isolation or introduce a lookup-failure fallback. A missing required mapping MUST be corrected or the runtime integration reverted; it MUST NOT be bypassed by silently selecting a company.

#### Scenario: Runtime is enabled only after mappings

- GIVEN host-based resolution is not yet enabled
- WHEN rollout is performed
- THEN the registry migration MUST be applied before mappings are registered
- AND intended mappings MUST be verified before the resolver serves storefront traffic

#### Scenario: Runtime rollback retains isolation

- GIVEN host-based resolution causes an operational lockout
- WHEN the runtime integration is rolled back
- THEN the additive registry MAY remain in place
- AND Gate 1 database isolation MUST remain effective
- AND no lookup-failure fallback MUST be introduced

### Requirement: Existing integrity and instance compatibility are preserved

Gate 1 database catalog and stock isolation MUST remain effective, including invoker-rights stock access, denial of anonymous direct stock authority, and authenticated company scoping. This change MUST NOT weaken atomic stock behavior or alter existing checkout, checkout-idempotency, order, or payment contracts. `instance.config` values for branding, locale, currency, metadata, shared assets, authentication namespace, provisioning slug, OAuth URLs, and payment behavior MUST remain instance-wide and compatible; the configured store slug MUST cease to be a public storefront read-tenant fallback or selector.

#### Scenario: Existing database isolation remains intact

- GIVEN authenticated or anonymous access covered by Gate 1 isolation
- WHEN catalog or stock data is requested
- THEN the existing role and company isolation guarantees MUST remain effective

#### Scenario: Transactional contracts remain unchanged

- GIVEN an existing checkout, repeated checkout, order operation, payment flow, or stock mutation
- WHEN host-based read resolution is introduced
- THEN its existing ownership, idempotency, payment, order-state, and atomic stock contracts MUST remain unchanged

#### Scenario: Non-routing instance configuration remains compatible

- GIVEN two mapped hosts use the same deployed instance configuration
- WHEN either storefront is requested
- THEN Host MUST select the read tenant
- AND remaining instance-wide branding, locale, currency, metadata, assets, authentication, OAuth, payment, and provisioning settings MUST continue to apply
