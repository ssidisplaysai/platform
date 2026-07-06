# Genesis OS Definition of Done

Every piece of Codex work must satisfy the full checklist below before it is considered complete.

## Architecture Compliance

- The change follows Clean Architecture boundaries.
- Runtime behavior remains in the runtime layer.
- Business logic remains in services.
- Data access remains in repositories.
- UI remains presentation-only and does not own business logic or persistence.
- The implementation does not bypass the Genesis domain/runtime architecture.

## Runtime and Platform Integrity

- The relevant runtime boot path still works.
- Runtime boot tests pass for the affected platform behavior.
- No fallback definitions are introduced for canonical domain objects.
- No duplicate compatibility aliases or import-shim files are introduced.
- Imports use the canonical existing files and do not create parallel schema/type definitions.

## Engineering Standards

- Only complete files are created or updated.
- No UI data access is introduced.
- Services own business logic.
- Repositories own data access.
- The implementation is explicit, maintainable, and reviewable.

## Verification

- Relevant tests pass.
- The change is verified with fresh command output.
- The work does not leave unresolved runtime or architecture regressions.

## Documentation and Delivery

- Documentation is updated when architecture, runtime, or engineering practices change.
- Git status is clean before completion unless an existing unrelated change is intentionally left in place.
- The change is ready for review with a clear summary of behavior, verification, and any remaining risks.
