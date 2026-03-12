@explore

You are auditing a Next.js + Supabase ecommerce codebase.

## Goal

Help me understand how to manually implement or review a coherent **write endpoint** in this repo.

The current concrete case may be something like:
- `POST /api/ecommerce/pedido`
- `POST /api/ecommerce/checkout`
- `POST /api/panel/...`
- any endpoint that creates, updates, consolidates, or triggers meaningful domain state changes

I do **not** want automatic code changes.
I want a **clear Markdown analysis** that helps a human developer implement the endpoint manually and coherently.

---

## Current architectural style

Respect this architecture:

- DB = sovereign domain
- RPC = critical write operations
- API = thin orchestration
- UI = consumer only

Important principles:
- critical domain truth should not live in the client
- thin endpoints are preferred
- domain invariants should be protected in DB / RPC when applicable
- prefer minimal payloads
- avoid duplicated business logic across API and DB

Do **not** propose broad redesigns.
Do **not** suggest rewriting the system.
Prefer minimal coherent implementation steps.

---

## Current domain context

This is a SaaS ecommerce with multitenancy concerns.

The concrete module under review may involve:
- orders
- payments
- checkout
- stock
- panel writes
- status transitions
- any write path with meaningful domain impact

Relevant entities may include tables, RPCs, API handlers, and runtime wiring already present in the repo.

Your job is to inspect the real repo and reason from evidence.

---

## What I need you to audit

Please inspect the repo and help me understand:

1. What existing **write endpoint patterns** already exist in the repo that I can reuse?
   - Look for similar POST / PATCH / PUT endpoints in `src/pages/api/**`
   - Supabase server usage patterns
   - existing error mapping patterns
   - existing request validation patterns
   - existing response shaping patterns

2. For the concrete endpoint under review, what is the **smallest coherent payload**?
   I want to avoid sending derived or sovereign data from the client when the backend can reconstruct it safely.

3. What logic should live in the endpoint, and what logic should **not** live in the endpoint?
   I want you to distinguish clearly between:
   - transport / edge validation
   - orchestration
   - domain validation
   - sovereign business logic
   - side effects

4. Does this write path look like:
   - a direct table write
   - a DB function / RPC call
   - a multi-step operation that should be made atomic
   Explain the safest minimal v1 pattern.

5. What invariants or safety checks must be protected?
   Think about:
   - tenancy isolation
   - ownership
   - stock consistency
   - payment/order coherence
   - idempotency
   - forbidden state transitions
   - prevention of partial writes
   - cross-tenant leakage
   - trusting client-sent derived values

6. What errors should be considered **domain errors** vs **unexpected errors**?
   I want a useful split between:
   - input / validation problems
   - domain rejections
   - conflicts / invalid state
   - unexpected infra/runtime failures

7. What are the likely mistakes if this endpoint is implemented too quickly?
   Focus on:
   - putting business logic in the endpoint
   - trusting client values that should be reconstructed
   - bypassing tenancy checks
   - non-atomic writes
   - bad error semantics
   - creating partial or incoherent state

8. Based on the repo, what is the **minimum manual execution plan** for implementing or hardening this write endpoint?

---

## Important constraints

- Return the answer in **Markdown only**
- Do not generate final production code
- Do not modify files
- Do not redesign the whole system
- Do not invent DB contracts that are not evidenced
- Prefer a practical v1 that is useful immediately
- Keep the endpoint thin whenever possible
- Do not assume auth/session or tenant resolution that is not clearly evidenced in the repo
- If tenant/ownership/auth resolution is unclear, explicitly say so
- Distinguish clearly between:
  - what is evidenced in the repo
  - what is inferred
  - what remains uncertain

---

## Output format

# Write Endpoint Audit

## A) Existing Repo Patterns
- list reusable files/endpoints/patterns
- include exact file references

## B) Recommended v1 Scope
- explain what the endpoint should do in the first coherent version

## C) Recommended Payload Contract
- show a sample request JSON in markdown
- keep it minimal and coherent

## D) What Should Live in the Endpoint
- list only what belongs in the API layer

## E) What Should Not Live in the Endpoint
- list domain logic that should live elsewhere

## F) Required Domain / Safety Checks
- bullet list of checks that must be protected
- explicitly call out which ones should live in DB / RPC if applicable

## G) Error Model
- separate:
  - edge/input errors
  - domain errors
  - conflicts/invalid state
  - unexpected errors

## H) Likely Implementation Mistakes
- bullet list

## I) Minimal Manual Execution Plan
- ordered steps
- focused on manual implementation in the repo

## J) Final Recommendation
Answer clearly:

**What is the smallest coherent and safe version of this write endpoint for the current stage?**

## K) Confidence / Open Questions
- what is clearly evidenced in the repo
- what is inferred
- what remains uncertain