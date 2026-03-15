# Production Checkout Validation Playbook

## Role

You are acting as a **technical auditor and operations planner** for this ecommerce system.

Your task is NOT to modify the codebase.

Your task is to produce a **human-executable production validation playbook** for the checkout flow, based on the codebase as it exists today.

The plan will be reviewed and approved by the project architect before any execution happens.

## Context

This project is an ecommerce SaaS built with:

- Next.js API routes
- Supabase Postgres (domain + RPC)
- Mercado Pago Checkout Pro
- Admin panel for operational visibility

Architecture pattern:

Client UI  
↓  
Next.js API endpoints  
↓  
Postgres domain layer (constraints + RPCs)

Critical RPCs already implemented:

- `crear_pedido_con_items(...)`
- `crear_intento_pago(...)`
- `procesar_notificacion_intento_pago(...)`
- `consolidar_pago_pedido(...)`

Admin observability exists:

- `/panel/pedidos`
- `/panel/pedidos/[id]`

Payment integration:

- Mercado Pago Checkout Pro
- webhook endpoint: `/api/webhooks/mercadopago`

The system is already deployed.

Goal now is to validate the checkout system using **real production infrastructure**.

## Objective

Produce a **practical step-by-step execution plan** for validating the checkout flow in production.

The output must be usable by the architect to:

- review
- approve
- execute manually

Do NOT propose architectural changes.  
Do NOT generate code.  
Do NOT suggest large testing frameworks.

Only design the **execution sequence**.

## Instructions

- Base the plan on the **actual repository**.
- Only mention endpoints, RPCs, tables, fields, states, and flows that can be inferred from the codebase.
- If something cannot be confirmed, label it clearly as:
  - **Assumption**
  - **Needs manual confirmation**
- Do NOT invent observability or monitoring that is not visible in the repo.
- Focus on **production-safe manual validation**.
- Prefer **minimal-risk, high-signal** execution.
- Treat **webhook receipt** and **order consolidation** as separate validation checkpoints.
- Require **before/after evidence**, especially for stock and order state.

## Output expected

Return a markdown document with the following sections:

## 1. Preparation phase

List what must exist before testing.

Split into:

- **Required before execution**
- **Recommended but optional**

Include items such as:

- test product
- stock configuration
- test buyer
- admin visibility
- environment verification
- DB access for verification
- correlation IDs to capture during execution

## 2. Pre-test snapshot

Describe exactly what should be captured before starting the payment flow.

Include:

- product or variant stock before purchase
- tenant/company being used
- buyer identity
- admin identity
- expected product price
- expected quantity
- expected order shape after creation

## 3. Primary validation scenario

Describe the main scenario:

**one real successful purchase in production**

Provide a step-by-step sequence.

For each step include:

- **Action**
- **Expected result**
- **Evidence to capture**
- **Stop if fails**

The sequence should cover:

- storefront order creation
- initial DB verification
- payment attempt creation
- Checkout Pro opening
- successful payment
- webhook receipt
- payment processing
- sovereign order consolidation
- final DB verification
- admin panel verification

## 4. Database verification points

List exactly what must be verified in:

- `pedido`
- `pedido_item`
- `intento_pago`

Include only fields that are visible in the repo or strongly implied by the implemented flow.

For each table include:

- key fields to inspect
- expected state before payment
- expected state after successful consolidation

## 5. Webhook validation

Explain how to confirm that the webhook was:

1. received  
2. processed  
3. correlated to the correct `intento_pago`  
4. followed by the correct domain transition

Include:

- logs or runtime evidence to check
- DB fields to inspect
- correlation chain across internal and provider identifiers

If any part is not directly confirmable from the repo, mark it as an assumption.

## 6. Stock verification

Explain how to validate stock safely and precisely.

Include:

- stock before purchase
- stock after successful consolidation
- exact expected delta
- variant-level verification if variants apply
- confirmation that stock changed **exactly once**

## 7. Admin panel verification

Explain what must appear in:

- `/panel/pedidos`
- `/panel/pedidos/[id]`

Describe what should be checked for consistency against DB state, especially:

- order state
- totals
- timestamps
- shipping snapshot
- items
- latest payment attempt

## 8. Secondary scenarios (optional)

Include concise operational follow-up scenarios such as:

- rejected payment
- expired order
- duplicate webhook
- stock blocking

Keep them short and execution-oriented.

## 9. Execution checklist

Provide a short checklist that a human operator can use during the test.

Example style:

- product prepared
- stock captured before test
- order created
- payment attempt created
- checkout opened
- payment approved
- webhook received
- payment processed
- order consolidated
- stock updated once
- admin panel matches DB

## 10. Success criteria

Define what must be true to conclude that checkout has been validated successfully in production.

This must include:

- successful end-to-end purchase
- correct DB persistence
- webhook receipt
- correct payment state transition
- correct order consolidation
- exact one-time stock impact
- admin panel consistency
- no unexpected 500s in the critical path

## 11. Open questions / assumptions

List anything that could not be fully confirmed from the repository and should be reviewed manually before execution.

## Final goal

The final output should function as a **production-safe, human-executable validation playbook** for the real checkout system.
