@explore

You are auditing a Next.js + Supabase ecommerce codebase.

## Goal

Help me understand how to manually implement a coherent **read endpoint** in this repo.

Current concrete case:

`GET /api/ecommerce/pedido/:id`

I do **not** want automatic code changes.
I want a **clear Markdown analysis** that helps a human developer implement the endpoint manually and coherently.

---

## Current architectural style

Respect this architecture:

- DB = sovereign domain
- RPC = critical write operations
- API = thin orchestration
- UI = consumer only

Do **not** propose broad redesigns.
Do **not** suggest rewriting the system.
Prefer minimal coherent implementation steps.

---

## Current domain context

The codebase is a SaaS ecommerce with multitenancy concerns.

The current concrete domain under review is B3 orders / payment / consolidation.

Known relevant tables:
- `pedido`
- `pedido_item`
- `intento_pago`
- `producto`
- `producto_variante`
- `direccion_usuario`

Known relevant RPCs:
- `public.crear_pedido_con_items(...)`
- `public.consolidar_pago_pedido(...)`

Current runtime direction:
- order creation is being stabilized
- a natural next read endpoint is:
  `GET /api/ecommerce/pedido/:id`

---

## What I need you to audit

Please inspect the repo and help me understand:

1. What existing API read patterns already exist in the repo that I can reuse?
   - Look for similar GET endpoints in `src/pages/api/**`
   - auth / tenant resolution patterns
   - response shaping patterns
   - Supabase server usage patterns

2. For `GET /api/ecommerce/pedido/:id`, what is the **smallest coherent response contract**?
   I want something useful for:
   - runtime visibility
   - debugging
   - UI inspection
   - multitenant safety

3. What data should the endpoint return?
   Evaluate whether the response should include:
   - pedido core fields
   - items
   - total
   - estado
   - expira_en
   - direccion_envio_snapshot
   - timestamps
   - intento_pago_consolidado_id
   - anything else truly necessary

4. What data should the endpoint **not** expose?
   Think about:
   - unnecessary internal fields
   - cross-tenant leakage
   - editorial/internal data not needed at this stage

5. What is the safest lookup pattern?
   Should the endpoint:
   - query by `pedido.id` only?
   - query by `pedido.id + empresa_id`?
   - verify ownership through usuario / empresa / session context?
   Explain the safest and simplest v1 pattern.

6. What are the likely mistakes if this endpoint is implemented too quickly?
   Focus on:
   - tenant leakage
   - overfetching
   - underfetching
   - exposing a pedido from another company
   - returning data in a shape that blocks future checkout/debugging work

7. Based on the repo, what is the **minimum manual execution plan** for implementing it?

---

## Important constraints

- Return the answer in **Markdown only**
- Do not generate final production code
- Do not modify files
- Do not redesign B3
- Do not change DB contracts
- Keep the endpoint as a read-only API layer
- Prefer a practical v1 that is useful immediately
- Do not assume auth/session or tenant resolution that is not clearly evidenced in the repo
- If ownership or tenant resolution is unclear, explicitly say so
- Distinguish clearly between:
  - what is evidenced in the repo
  - what is inferred
  - what remains uncertain

---

## Output format

# Read Endpoint Audit — GET /api/ecommerce/pedido/:id

## A) Existing Repo Patterns
- list reusable files/endpoints/patterns
- include exact file references

## B) Recommended v1 Scope
- explain what the endpoint should do in the first coherent version

## C) Recommended Response Contract
- show a sample JSON response in markdown
- keep it minimal but useful

## D) Required Safety / Tenancy Checks
- bullet list of checks the endpoint must perform

## E) Fields to Include
- list and explain why

## F) Fields to Avoid Exposing
- list and explain why

## G) Likely Implementation Mistakes
- bullet list

## H) Minimal Manual Execution Plan
- ordered steps
- focused on manual implementation in the repo

## I) Final Recommendation
Answer clearly:

**What is the smallest coherent and safe version of `GET /api/ecommerce/pedido/:id` for the current stage?**

## J) Confidence / Open Questions
- what is clearly evidenced in the repo
- what is inferred
- what remains uncertain