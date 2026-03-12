@explore

You are auditing a Next.js + Supabase ecommerce codebase.

## Goal

Help me understand the likely impact of a **domain change** before I implement it manually.

A domain change may include things like:
- adding or removing a column
- changing a DB contract
- modifying an RPC signature or behavior
- changing the response shape of an endpoint
- introducing a new invariant
- changing a status flow
- altering a write/read path that may affect multiple layers

I do **not** want automatic code changes.
I want a **clear Markdown analysis** that helps a human developer understand the impact of the change and apply it manually with minimal risk.

---

## Current architectural style

Respect this architecture:

- DB = sovereign domain
- RPC = critical write operations
- API = thin orchestration
- UI = consumer only

Important principles:
- domain truth should have a single clear source
- critical invariants should be protected close to the domain
- changes should be minimal, explicit, and auditable
- avoid spreading one contract change across many layers without understanding impact first
- prefer coherent, small-step evolution over broad redesign

Do **not** propose broad redesigns.
Do **not** suggest rewriting the system.
Prefer minimal coherent change plans.

---

## Current domain context

This is a SaaS ecommerce with multitenancy concerns.

The concrete change under review may affect:
- DB tables / constraints / triggers
- RPC functions
- Next.js API endpoints
- panel runtime
- ecommerce runtime
- auth / tenancy resolution
- response contracts consumed by UI

Your job is to inspect the real repo and reason from evidence.

---

## What I need you to audit

Please inspect the repo and help me understand:

1. What parts of the repo are likely impacted by the domain change under review?
   Look for:
   - SQL migrations
   - RPC definitions
   - API handlers
   - UI consumers
   - shared helpers
   - types / response contracts
   - business flows that may depend on the changed contract

2. What is the **current source of truth** for the thing being changed?
   I want to understand where the domain truth currently lives:
   - DB table
   - DB constraint
   - trigger
   - RPC
   - API shape
   - frontend assumption
   Explain what is clearly evidenced.

3. What invariants or contracts might break if the change is implemented naively?
   Think about:
   - tenant isolation
   - ownership
   - payment/order coherence
   - stock invariants
   - response compatibility
   - status transitions
   - derived values
   - snapshots
   - hidden coupling across layers

4. What areas are likely to require updates?
   Identify:
   - files that likely must change
   - files that likely should be reviewed
   - files that might become inconsistent if ignored

5. What is the **smallest coherent change set**?
   I do not want a broad rewrite.
   I want to know the minimum set of coordinated updates needed so the system remains coherent.

6. What are the likely mistakes if I change this too quickly?
   Focus on:
   - updating only one layer
   - forgetting a dependent consumer
   - breaking an RPC contract
   - drifting API shape from DB truth
   - introducing tenant leaks
   - leaving old assumptions alive in UI or handlers

7. Based on the repo, what is the **minimum manual execution plan** for applying the change safely?

---

## Important constraints

- Return the answer in **Markdown only**
- Do not generate final production code
- Do not modify files
- Do not redesign the whole system
- Do not invent contracts not evidenced in the repo
- Prefer a practical minimal change plan
- Distinguish clearly between:
  - what is evidenced in the repo
  - what is inferred
  - what remains uncertain
- If the source of truth is ambiguous, explicitly say so
- Prefer identifying impact and risk over proposing broad improvements

---

## Output format

# Domain Change Impact Audit

## A) Change Under Review
- restate the change in clear technical terms
- explain what part of the domain it touches

## B) Current Source of Truth
- explain where the relevant domain truth currently lives
- include exact file references when possible

## C) Likely Impacted Areas
- list files / layers likely affected
- separate:
  - must change
  - should review
  - possible indirect impact

## D) Invariants / Contracts at Risk
- bullet list of domain rules or contracts that could break

## E) Smallest Coherent Change Set
- explain the minimum coordinated updates needed
- keep it practical and minimal

## F) Likely Implementation Mistakes
- bullet list

## G) Minimal Manual Execution Plan
- ordered steps
- focused on manual implementation in the repo

## H) Final Recommendation
Answer clearly:

**What is the smallest safe way to apply this domain change in the current codebase without breaking coherence?**

## I) Confidence / Open Questions
- what is clearly evidenced in the repo
- what is inferred
- what remains uncertain