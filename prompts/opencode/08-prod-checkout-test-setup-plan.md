# Production Checkout Test Setup Plan

## Role

You are acting as a **technical auditor and setup planner** for this ecommerce system.

Your task is NOT to modify the codebase.

Your task is to produce a **human-executable setup plan** to prepare a safe production test case for checkout validation.

The plan will be reviewed by the project architect before any manual execution happens.

## Context

This project is an ecommerce SaaS built with:

- Next.js API routes
- Supabase Postgres
- Mercado Pago Checkout Pro
- Admin panel

Architecture pattern:

Client UI  
↓  
Next.js API endpoints  
↓  
Postgres domain layer (constraints + RPCs)

Relevant implemented modules already exist:

- products
- variants and stock
- product images
- orders
- payment attempts
- Mercado Pago integration
- admin panel
- order admin list/detail

The system is already deployed.

The next operational need is to prepare a **small, controlled, production-safe test case** before running the first real checkout validation.

## Objective

Produce a **practical setup plan** for preparing the test case needed for checkout validation in production.

Focus on how to prepare:

- a test product
- stock
- optional variant
- buyer account
- admin account
- shipping address
- tenant/company scope
- evidence to capture before starting the payment flow

Do NOT generate code.  
Do NOT propose architectural changes.  
Do NOT suggest large frameworks.  
Only design the **manual setup sequence**.

## Instructions

- Base the plan on the **actual repository**.
- Only mention pages, endpoints, tables, fields, or flows that can be inferred from the repo.
- If something cannot be confirmed from the repo, label it clearly as:
  - **Assumption**
  - **Needs manual confirmation**
- Do NOT invent admin capabilities that are not visible in the codebase.
- Prefer the **smallest safe setup** that allows one real production checkout.
- Optimize for:
  - low risk
  - easy observability
  - easy DB verification
  - easy admin verification

## Output expected

Return a markdown document with the following sections:

## 1. Goal of the setup

Explain what this setup is preparing for:
one controlled real checkout validation in production.

## 2. Minimum test data to prepare

List the minimum things that must exist before the test:

- tenant/company
- test product
- product price
- stock
- variant if applicable
- buyer account
- admin account
- shipping address

For each one, explain whether it is:
- required
- optional
- repo-confirmed
- assumption
- needs manual confirmation

## 3. Recommended product shape

Describe the safest recommended shape for the test product.

Include guidance such as:

- low price
- easy-to-recognize name
- low but safe stock
- whether variants should be avoided unless necessary
- whether images are necessary for the test or not

Only include recommendations supported by the repo and operational logic.

## 4. Step-by-step setup sequence

Provide a human-executable sequence to prepare the case.

For each step include:

- **Action**
- **Expected result**
- **Evidence to capture**
- **Stop if fails**

This should include, where supported by the repo:

- how to identify or create the company/tenant to use
- how to identify or create the product
- how to verify stock before the test
- how to identify or create the buyer account
- how to identify the admin account
- how to prepare a recognizable shipping address
- how to confirm the setup is ready for checkout validation

## 5. Stock preparation and verification

Explain how to prepare stock for the test safely.

Include:

- exact stock to capture before starting
- whether to prefer quantity = 1
- whether to avoid variant complexity unless required
- what must be verified in DB before running the checkout test

If stock storage path is not fully inferable from the repo, mark it clearly.

## 6. Pre-flight evidence sheet

List the exact identifiers and values the operator should record before starting the payment flow.

Include items such as:

- tenant/company identifier
- product identifier
- variant identifier if any
- price
- quantity
- stock before
- buyer identity
- admin identity
- expected checkout scenario

## 7. Readiness checklist

Provide a concise checklist to decide whether the setup is ready.

Example style:

- tenant chosen
- product chosen
- price confirmed
- stock confirmed
- buyer ready
- admin ready
- shipping address ready
- panel access confirmed
- DB verification access confirmed
- setup approved for first production checkout test

## 8. Open questions / assumptions

List anything that cannot be fully confirmed from the repository and must be reviewed manually before setup execution.

## Final goal

The final output should function as a **small, controlled setup playbook** for preparing the first real checkout validation in production.
