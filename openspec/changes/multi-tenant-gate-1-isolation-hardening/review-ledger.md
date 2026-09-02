# Review Ledger

| ID | Lens | Severity | Finding | Resolution |
| --- | --- | --- | --- | --- |
| R1 | Risk | High | Existing authenticated/service-role view grants included non-SELECT privileges. | Fixed by revoking all exposed-role grants before granting SELECT only; regression asserts the exact grant set. |

No surviving blocker or critical finding. Runtime subagent review tools were unavailable, so the security review was performed inline and backed by direct catalog/grant inspection plus two-tenant PostgREST tests.
