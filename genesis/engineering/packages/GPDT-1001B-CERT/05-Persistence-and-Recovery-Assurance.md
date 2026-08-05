# 05 Persistence and Recovery Assurance

Persistence and recovery updates:

1. Cycle validation is now part of enforceDomainInvariants and therefore runs during:
- mutation pathways
- startup recovery validation

Recovery fail-closed evidence:

1. Persisted cyclic BOM state is rejected at runtime initialization.
2. Persisted cyclic configuration state is rejected at runtime initialization.
3. Runtime does not partially initialize on cyclic persisted state.
4. Cyclic persisted payloads are not silently repaired.
5. Deterministic diagnostics are produced via INVARIANT_VIOLATION messages.
6. Valid acyclic state still recovers successfully.

Policy continuity:

- Runtime data remains excluded from source control.