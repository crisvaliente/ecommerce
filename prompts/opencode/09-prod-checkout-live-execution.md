# ROLE
You are acting as a **technical operator copilot** for a live production checkout validation.

Your task is NOT to modify the codebase.

Your task is to guide a **small, controlled, human-executed validation run** of the checkout flow in production.

The architect/operator will execute the steps manually.
You must help by structuring the run, defining checkpoints, and telling the operator what to verify before continuing.

# CONTEXT

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

Relevant implemented flow already exists:

- order creation
- payment attempt creation
- Mercado Pago Checkout Pro
- webhook endpoint `/api/webhooks/mercadopago`
- payment processing
- sovereign consolidation in DB
- admin visibility in:
  - `/panel/pedidos`
  - `/panel/pedidos/[id]`

Critical RPCs already implemented:

- `crear_pedido_con_items(...)`
- `crear_intento_pago(...)`
- `procesar_notificacion_intento_pago(...)`
- `consolidar_pago_pedido(...)`

This execution should validate **one real successful purchase in production** using a small, controlled test case already prepared in advance.

# OBJECTIVE

Produce a **live execution guide** for one controlled production checkout validation.

The output must guide the operator through the run in order, with strict checkpoints.

Do NOT propose architectural changes.  
Do NOT generate code.  
Do NOT suggest large frameworks.  
Do NOT redesign the flow.

Only produce the **execution sequence** and **decision gates** for the live run.

# AUDIT RULES

- Base the execution guide on the **actual repository**.
- Only mention pages, endpoints, tables, fields, and states that can be inferred from the repo.
- If something cannot be confirmed, label it clearly as:
  - **Assumption**
  - **Needs manual confirmation**
- Treat this as a **live controlled operation**, not a design exercise.
- Prefer:
  - one scenario
  - one path
  - one decision at each gate
- Separate these checkpoints clearly:
  1. order created
  2. payment attempt created
  3. Checkout Pro opened
  4. payment completed
  5. webhook received
  6. payment processed
  7. order consolidated
  8. stock updated once
  9. admin panel matches DB

# OUTPUT FORMAT

Return a markdown document with the following sections:

## 1. Scope of this execution

State clearly that this run is only for:

- one real successful purchase
- one controlled tenant/company
- one prepared product
- one buyer
- one admin verification pass

Also state what is explicitly out of scope for this run, such as:

- rejected payment
- duplicate webhook
- expired order
- stock race scenarios
- code changes during execution

## 2. Preconditions before starting

List what must already be ready before the live run starts.

This should reference the prepared setup, including:

- tenant/company chosen
- buyer ready
- admin ready
- product ready
- stock captured before test
- shipping address ready
- DB verification access ready
- panel access ready
- production-safe payment method approved

## 3. Live execution sequence

Provide the step-by-step live execution.

For each step include:

- **Action**
- **Expected result**
- **Evidence to capture**
- **Gate decision**
- **Do not continue if**

The sequence must cover:

1. confirm pre-flight sheet
2. buyer starts checkout flow
3. order is created
4. verify initial `pedido`
5. verify `pedido_item`
6. create payment attempt
7. verify `intento_pago`
8. open Checkout Pro
9. complete payment
10. verify webhook receipt
11. verify payment processing
12. verify sovereign order consolidation
13. verify stock after consolidation
14. verify `/panel/pedidos`
15. verify `/panel/pedidos/[id]`
16. close the run with a final result

Additional refinement requirements for the produced live playbook:

- In **Step 10 — Verify webhook receipt**:
  - after:
    - `Do not continue if`
    - `no webhook evidence exists after a reasonable wait`
  - add an operational note stating:
    - allow a short controlled wait window before classifying webhook receipt as failed

- In **Step 14 — Verify /panel/pedidos**:
  - after:
    - `Do not continue if`
    - `the order is missing or values visibly diverge from DB`
  - add an operational note stating:
    - allow a manual refresh/reload before classifying this as panel inconsistency

- In **Step 15 — Verify /panel/pedidos/[id]**:
  - after:
    - `Do not continue if`
    - `panel detail is inconsistent with DB`
  - add an operational note stating:
    - allow a manual refresh/reload before classifying this as panel inconsistency

## 4. Gate checks

Create a compact gate list for the operator.

Example style:

- Gate 1 — `pedido` created
- Gate 2 — `pedido` coherent before payment
- Gate 3 — `intento_pago` created
- Gate 4 — `preference_id` present
- Gate 5 — Checkout Pro opened
- Gate 6 — payment approved
- Gate 7 — webhook received
- Gate 8 — `intento_pago` updated
- Gate 9 — `pedido` consolidated
- Gate 10 — stock changed exactly once
- Gate 11 — panel matches DB

For each gate, explain:
- what proves the gate passed
- what blocks the run
- whether the next step is allowed

Additional refinement requirement for **Gate 8 — `intento_pago` updated**:

- replace the default “Passes if” wording with a stricter version that says:
  - it passes if `external_id`, `notificado_en`, and payment-related metadata are persisted, and `intento_pago.estado = aprobado` or the exact implemented success-equivalent state confirmed in the repository

## 5. Evidence to capture during execution

List the exact identifiers and state snapshots the operator should write down during the run.

Include:

- `empresa_id`
- buyer identity
- admin identity
- product identifier
- variant identifier if any
- quantity
- stock before
- `pedido_id`
- `pedido.estado` before payment
- `intento_pago.id`
- `preference_id`
- provider payment id if visible
- `intento_pago.estado` after webhook
- `pedido.estado` after consolidation
- `pedido.intento_pago_consolidado_id`
- stock after
- panel confirmation notes

## 6. Failure handling during the run

Explain what to do if the run stops at any gate.

Focus on operational behavior, such as:

- stop the run
- record the last successful gate
- record evidence
- classify the failure point
- do not improvise code changes mid-run
- do not jump to secondary scenarios

Group failure points into categories like:

- order creation failure
- payment attempt failure
- checkout opening failure
- payment completion failure
- webhook failure
- payment processing failure
- consolidation failure
- stock inconsistency
- panel inconsistency

## 7. Final classification

Define the only allowed closing outcomes:

- **Validated**
- **Partially validated**
- **Blocked**

Explain what each means in this live run.

## 8. Post-run closure

Specify what should be produced immediately after the run:

- short execution summary
- captured evidence list
- final classification
- next step recommendation

## 9. Open questions / assumptions

List anything that cannot be fully confirmed from the repository and must be handled manually by the architect/operator before or during the run.

# GOAL

The final output should function as a **live execution playbook** for one small, controlled production checkout validation.
