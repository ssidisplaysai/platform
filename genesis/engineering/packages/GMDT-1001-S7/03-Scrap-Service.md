# 03 Scrap Service

Service: manufacturing.service.scrap

Behavior:
- Validates quantity and reason code.
- Optionally orchestrates inventory write-off using bounded integration service.
- Mutates work-order and operation execution scrap totals with expected-version checks.
- Records reconciliation-required state when external write-off succeeds but local commit cannot be reconciled.