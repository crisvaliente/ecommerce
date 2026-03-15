@explore

# Tenancy / RLS Audit

## Role

You are auditing a Next.js + Supabase ecommerce codebase.

## Objective

Help me understand the current **tenancy and RLS safety model** of a concrete module or flow in this repo.

A tenancy / RLS audit may include things like:
- verifying tenant boundaries
- checking whether a flow can cross empresa_id improperly
- checking ownership assumptions
- identifying places where service-role usage bypasses RLS
- detecting places where the API trusts client-sent identifiers too much
- reviewing whether critical protections live in DB, RLS, triggers, RPCs, or only in handlers/UI

I do **not** want automatic code changes.
I want a **clear Markdown analysis** that helps a human developer understand the safety model and manually harden the module if needed.

---

## Context

### Current architectural style

Respect this architecture:

- DB = sovereign domain
- RPC = critical write operations
- API = thin orchestration
- UI = consumer only

Important principles:
- multitenancy boundaries must be explicit
- ownership checks must not depend on UI trust
- service-role usage must be treated as privileged and dangerous by default
- RLS is valuable, but cannot be assumed where service-role or SECURITY DEFINER flows are involved
- tenant invariants should be protected as close to the domain as possible
- prefer minimal, explicit, auditable hardening

Do **not** propose broad redesigns.
Do **not** suggest rewriting the whole system.
Prefer minimal coherent hardening steps.

---

### Current domain context

This is a SaaS ecommerce with multitenancy concerns.

The concrete module or flow under review may involve:
- products
- categories
- orders
- payments
- addresses
- panel writes
- ecommerce runtime
- auth/session resolution
- any path where empresa_id, usuario_id, auth.uid(), or service-role access matters

Your job is to inspect the real repo and reason from evidence.

---

## Instructions

Please inspect the repo and help me understand:

1. What is the current tenancy / ownership model evidenced in the repo?
   Look for:
   - `empresa_id`
   - `usuario_id`
   - `supabase_uid`
   - `auth.uid()`
   - public.usuario lookups
   - helpers or functions used for ownership checks
   - route/runtime patterns that imply tenant resolution

2. Where is tenant isolation currently enforced?
   Identify protections that may live in:
   - RLS policies
   - DB constraints
   - triggers
   - RPC validation
   - API handlers
   - panel auth gates
   - frontend assumptions

3. Where can tenant or ownership leakage happen?
   Focus on:
   - service-role clients
   - SECURITY DEFINER RPCs
   - body/query params that include `empresa_id` or `usuario_id`
   - direct table reads/writes in privileged contexts
   - ambiguous identity translation between `auth.uid()` and `public.usuario.id`

4. For the concrete module or endpoint under review, what are the **required safety checks**?
   I want the minimum set of checks needed so the flow is tenant-safe and ownership-safe for the current stage.

5. Which protections should live in API vs DB / RPC vs RLS?
   Distinguish clearly between:
   - transport/auth gate checks
   - tenant resolution
   - ownership validation
   - domain invariants
   - privileged bypass risks

6. What parts of the repo appear inconsistent or ambiguous regarding tenancy?
   For example:
   - one place uses `auth.uid()`
   - another uses `public.usuario.id`
   - another trusts `empresa_id` from request body
   - another relies on RLS that is bypassed elsewhere

7. What are the likely mistakes if this flow is implemented or extended too quickly?
   Focus on:
   - cross-tenant leakage
   - trusting client IDs
   - assuming RLS protects service-role flows
   - missing ownership checks
   - leaking another tenant’s data
   - writing into another tenant by mistake

8. Based on the repo, what is the **minimum manual hardening plan**?

---

## Constraints

- Return the answer in **Markdown only**
- Do not generate final production code
- Do not modify files
- Do not redesign the whole system
- Do not invent tenancy rules not evidenced in the repo
- Prefer minimal practical hardening
- Distinguish clearly between:
  - what is evidenced in the repo
  - what is inferred
  - what remains uncertain
- If the tenant boundary is ambiguous, explicitly say so
- If RLS is bypassed by service-role or SECURITY DEFINER paths, explicitly say so
- Prefer identifying real boundaries and risks over generic security advice

---

## Output expected

# Tenancy / RLS Audit

## A) Current Tenant / Ownership Model
- explain the identity and tenant model evidenced in the repo
- include exact file references when possible

## B) Where Isolation Is Enforced Today
- list protections currently enforced in:
  - RLS
  - DB constraints / triggers
  - RPC
  - API
  - auth/runtime gates

## C) Risky Boundaries / Leakage Points
- list concrete places where tenant or ownership leakage could happen
- include exact file references when possible

## D) Required Safety Checks for the Flow Under Review
- bullet list of checks the flow must perform
- explain which checks belong in API and which belong in DB / RPC

## E) Inconsistencies or Ambiguities
- list mismatches, unclear assumptions, or mixed identity models

## F) Likely Implementation Mistakes
- bullet list

## G) Minimal Manual Hardening Plan
- ordered steps
- focused on practical hardening, not redesign

## H) Final Recommendation
Answer clearly:

**What is the smallest coherent way to make this flow tenant-safe and ownership-safe in the current codebase?**

## I) Confidence / Open Questions
- what is clearly evidenced in the repo
- what is inferred
- what remains uncertain
