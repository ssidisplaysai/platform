# Architecture Boundaries

## Boundary Objective
Enforce strict one-way dependency progression:
Replay Runtime -> IBR Runtime -> Entity Runtime -> Relationship Runtime -> Business Rule Runtime -> Business Genome Assembly Runtime.

Only the IBR Runtime is authorized by this package.

## Boundary Enforcement Rules
- IBR may consume Replay runtime contracts only through approved runtime interfaces.
- IBR must not mutate Replay records.
- IBR must not write canonical entity or relationship stores.
- IBR must not execute policy arbitration as business rule outcomes.

## Runtime Ownership
- Runtime Owner: Phase 2 semantic runtime engineering owner.
- Governance Owner: Compiler constitutional governance owner.
- Certification Owner: Independent certification authority.

## Failure Behavior Boundary
When boundary violations are detected:
- Fail closed.
- Emit deterministic violation diagnostics.
- Block publication of observation outputs.
- Require governance incident record before continuation.