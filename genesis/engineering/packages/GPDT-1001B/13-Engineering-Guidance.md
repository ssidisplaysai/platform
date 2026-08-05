# 13 Engineering Guidance

Implementation guidance (definition only):

1. Contracts
- Use contract-first Product interfaces.
- Separate commands, queries, events, references, and observations.
- Version contracts alongside domain-version policy.

2. Persistence
- Persist Product-owned canonical definitions only.
- Store foreign references as stable identifiers.
- Enforce tenant-safe, auditable, fail-closed persistence semantics.

3. Runtime
- Preserve deterministic behavior.
- Preserve lifecycle and version integrity checks.
- Preserve ownership boundaries from GPDT-1001A and this domain model.

4. Services
- Align service boundaries with aggregate boundaries.
- Prohibit service-level ownership expansion into foreign domains.

5. Queries
- Query Product-owned definitions and reference joins through approved contracts only.
- Never bypass certified platform interfaces for foreign state.

6. Commands
- Commands mutate only Product-owned aggregates.
- Command validation must enforce invariants before state mutation.

7. Events
- Publish conceptual Product-domain events with ownership-neutral payloads.
- Do not use events to transfer foreign canonical ownership.

8. Testing
- Future implementation tests must include boundary, invariant, lifecycle, and versioning negative-path coverage.
- Include contract compatibility and reference-integrity regression tests.

9. Validation
- Future implementation must pass all conformance checklist controls from GPDT-1001A and validation rules from GPDT-1001B.

Non-authorization reminder:

- This guidance informs future implementation and does not authorize runtime engineering by itself.
