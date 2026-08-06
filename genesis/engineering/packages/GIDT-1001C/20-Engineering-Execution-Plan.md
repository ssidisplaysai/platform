# 20 Engineering Execution Plan

Commit strategy recommendation:

- Multiple focused engineering commits are recommended over a single foundation commit to isolate risk and improve validation traceability.

Slice 1: contracts and domain primitives
- Entry criteria: blueprint approved.
- Scope: command/query contracts, value objects, identifiers, errors.
- Tests: unit and invariant primitive tests.
- Validation: ownership and boundary checks.
- Exit: compile-level domain primitives stable.
- Prohibited: persistence or runtime composition.

Slice 2: shared-runtime composition
- Scope: runtime composition root and shared component wiring.
- Tests: startup sequencing and dependency resolution.
- Exit: deterministic startup skeleton with no domain services yet.
- Prohibited: business rule embedding in runtime layer.

Slice 3: InventoryItem, Warehouse, Location, Balance foundations
- Scope: foundational aggregates and services.
- Tests: invariant and state-transition tests.
- Exit: foundational state creation and read support.
- Prohibited: movement ledger operations beyond minimal stubs.

Slice 4: movement and ledger
- Scope: movement execution pipeline and append-only ledger handling.
- Tests: atomicity, no-partial-mutation, append-only behavior.
- Exit: movement command paths functional with ledger facts.
- Prohibited: reservation/allocation complexity.

Slice 5: reservation and allocation
- Scope: reservation and allocation aggregates and conversion rules.
- Tests: race, over-reservation, over-allocation, idempotency.
- Exit: commitment workflows stable.
- Prohibited: lot/serial expiration complexity.

Slice 6: lot, serial, and expiration
- Scope: lot/serial uniqueness and expiration/quarantine rules.
- Tests: serial race and expiry policy paths.
- Exit: traceability and expiration behavior stable.
- Prohibited: external reference adapter expansion.

Slice 7: reference validation
- Scope: integration adapters and validation policy orchestration.
- Tests: mandatory/optional references and tenant mismatch.
- Exit: foreign contract validation complete.
- Prohibited: foreign persistence access.

Slice 8: observability and Mission Control
- Scope: health, metrics, audit, observation publishers.
- Tests: observation isolation and read-only posture.
- Exit: observability baseline complete.
- Prohibited: mission-control mutation controls.

Slice 9: persistence and recovery hardening
- Scope: corruption handling, replay determinism, schema compatibility gates.
- Tests: unsupported schema and corruption fail-closed behavior.
- Exit: recovery and startup hardening complete.
- Prohibited: analytics expansion beyond inventory scope.

Slice 10: comprehensive testing and certification readiness
- Scope: end-to-end and negative-path completion.
- Tests: all strategy categories complete.
- Exit: engineering readiness for downstream validation and certification work.
- Prohibited: uncontrolled scope growth.

Cross-slice control:

1. Each slice requires explicit entry and exit checklist.
2. No slice introduces ownership-boundary violations.
3. Every slice updates architecture docs where behavior changes.