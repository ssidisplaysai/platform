# 05 Identifier Strategy

Identifier classes:
- Internal entity IDs: immutable canonical IDs for Manufacturing-owned entities
- Business identifiers: operator-visible numbers and codes
- External reference identifiers: foreign IDs stored as references only
- Version identifiers: monotonic execution versions
- Concurrency tokens: optimistic write guards
- Idempotency identifiers: duplicate-command control
- Correlation identifiers: cross-contract linkage IDs

## Rules

1. Canonical internal IDs are immutable and never reused silently.
2. Business identifiers are deterministic within approved uniqueness scope.
3. WorkOrderNumber uniqueness is mandatory within tenant scope.
4. RunCode and BatchCode uniqueness is explicit within tenant and policy scope.
5. Routing and operation identifiers are unique within routing/work-order scope.
6. Foreign identifiers remain references only and do not infer foreign ownership transfer.
7. Tenant uniqueness constraints are explicit in every entity model.
8. Retired business identifiers require explicit retirement records before possible policy-defined reuse.
9. Version identifiers increment strictly on successful mutations.
10. Concurrency tokens must match expected state; no silent last-write-wins.
11. Idempotency key scope includes tenant plus command type plus target identity.
12. Same idempotency key with conflicting payload is deterministically rejected.
