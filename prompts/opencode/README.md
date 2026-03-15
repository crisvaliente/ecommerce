# OpenCode Prompts Library

## Purpose

This folder contains reusable operational prompts used to audit, read, design, and validate the ecommerce system with a consistent OAF / OAF-TC style.

The library is meant to help a collaborator:

- inspect the real repo before acting
- separate evidence from inference
- keep outputs operational and auditable
- avoid broad redesigns when the task only needs a minimal coherent step

This is infrastructure for technical continuity, not a random list of one-off prompts.

## Families

### 01–04 Audit Prompts

Use these when the main task is analysis of one concrete technical surface.

- `01-read-endpoint-audit.md`
  - Read endpoint shape, lookup pattern, fields, and safe v1 contract.
- `02-write-endpoint-audit.md`
  - Write endpoint payload, thinness, invariants, atomicity, and error model.
- `03-domain-change-impact.md`
  - Cross-layer impact of a contract or domain change before implementation.
- `04-tenancy-rls-audit.md`
  - Tenant boundary, ownership, service-role, and RLS safety review.

### 05 Context / Continuity Prompt

Use this when you need a global operational picture of the repo before choosing the next block.

- `05-oaf-project-state-read.md`
  - Whole-project state read with clear separation between designed, implemented, integrated, validated, and release-ready.

### 06 Design Prompt

Use this when a new module needs to be shaped coherently before implementation.

- `06-panel-module-design.md`
  - Module design prompt for panel features, currently focused on admin pedidos patterns.

### 07–09 Production Validation Prompts

Use these as a sequence for controlled production checkout validation.

- `07-prod-checkout-validation-playbook.md`
  - Full production validation strategy for checkout.
- `08-prod-checkout-test-setup-plan.md`
  - Prepares the smallest safe production test case.
- `09-prod-checkout-live-execution.md`
  - Live execution runbook for one controlled real checkout.

## When to use each prompt

- Use `01` when the task is “how should this GET/read endpoint look?”
- Use `02` when the task is “how should this POST/write path work safely?”
- Use `03` when a DB/API/RPC contract will change and you need blast-radius analysis first.
- Use `04` when the main risk is tenant leakage, ownership, auth translation, or service-role bypass.
- Use `05` when you need to understand the real project state before deciding what to build next.
- Use `06` when a new panel/admin module needs a coherent minimal design before coding.
- Use `07` to define the full production validation strategy.
- Use `08` before the live run, to prepare test data and operating conditions.
- Use `09` during the live run, to execute with gates and evidence capture.

## Naming convention

Current convention is intentionally conservative:

- keep numeric ordering for stable invocation and operator memory
- keep a short descriptive slug after the number
- keep file names action-oriented rather than abstract

Pattern:

`NN-topic-purpose.md`

Examples:

- `01-read-endpoint-audit.md`
- `03-domain-change-impact.md`
- `08-prod-checkout-test-setup-plan.md`

Notes:

- `05-oaf-project-state-read.md` keeps the `oaf` prefix for continuity with the project’s continuity method. It is intentionally not renamed to avoid breaking established operator habits.
- `07` to `09` form a production-validation trilogy and should be kept numerically consecutive.

## Recommended usage flow

### For implementation work

1. Start with `05-oaf-project-state-read.md` if the repo state is unclear.
2. Use one or more focused audits:
   - `01` for read paths
   - `02` for write paths
   - `03` for domain changes
   - `04` for tenancy/auth safety
3. Use `06-panel-module-design.md` when the next step is a new panel/admin module.

### For production checkout validation

1. `07-prod-checkout-validation-playbook.md`
2. `08-prod-checkout-test-setup-plan.md`
3. `09-prod-checkout-live-execution.md`

Run them in that order unless there is already an approved validation plan.

## Structural observations of the current library

- `01` to `04` already share a strong common shape: goal, context, audit questions, constraints, and mandatory output.
- `07` to `09` already behave as an operational sequence.
- The main inconsistency today is not purpose but presentation:
  - `05` uses a different title style
  - `06` is narrower and more module-specific than the others
  - `07` to `09` use `ROLE / CONTEXT / OBJECTIVE`, while `01` to `04` use `Goal / Context / Output format`

This README standardizes the library conceptually without forcing unnecessary renames or broad edits to prompts that are already operationally useful.

## Conservative maintenance rules

- Prefer documenting families before renaming files.
- Rename prompts only when the current name creates real ambiguity or breaks operator continuity.
- Do not widen a prompt’s purpose unless the current scope is clearly blocking reuse.
- Keep prompts explicit about:
  - evidence vs inference
  - minimal safe next step
  - output format

## Gaps worth monitoring

No new prompt is strictly required right now.

Possible future additions only if the library grows:

- a dedicated `implementation-step-plan` prompt between audit and coding
- a dedicated `post-change-validation-audit` prompt for verifying a completed block before PR

These are not added now because the current library is still coherent without them.
