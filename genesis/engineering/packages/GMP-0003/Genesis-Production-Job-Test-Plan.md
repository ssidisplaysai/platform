# Genesis Production Job Test Plan

## Foundation Tests
- Validate Work Order -> Production Job conversion.
- Assert immutable lineage propagation for quote/sales/work ancestry.
- Assert deterministic lifecycle transition guardrails.
- Assert revision/audit/timeline/event emission behavior.
- Assert search and repository query behavior.

## API Tests
- Verify authorization denials and grants by role.
- Verify organization scope headers are required/enforced.
- Verify create/list/detail/search/revision/timeline/audit route behavior.
- Verify release/pause/resume/cancel transition command behavior.

## Quality Gates
- Run focused jest suites for production-job foundation and API.
- Run scoped lint/check errors on touched production-job files.
- Run boundary scan for prohibited scope leakage (operations/machine/scheduling/inventory/quality/MES/IoT implementation).

## Exit Criteria
- Tests pass for GMP-0003 suites.
- No blocking lint/type errors introduced by GMP-0003 files.
- Boundary scan confirms no prohibited implementation scope entered.
