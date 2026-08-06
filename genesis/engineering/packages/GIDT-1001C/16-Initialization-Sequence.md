# 16 Initialization Sequence

Deterministic startup order:

1. Create shared RuntimeHost.
- Fail-closed: host creation failure blocks startup.

2. Register inventory dependencies.
- Fail-closed: missing mandatory dependency blocks startup.

3. Register foreign-reference validators.
- Fail-closed: missing mandatory validators block startup.

4. Create inventory schema validator.
- Fail-closed: validator creation failure blocks startup.

5. Create file store.
- Fail-closed: inaccessible store blocks startup.

6. Create persistence coordinator.
- Fail-closed: coordinator wiring failure blocks startup.

7. Initialize audit, metrics, and health contributors.
- Fail-closed for mandatory audit path by policy; otherwise degraded health with explicit warning.

8. Compose inventory services and handlers.
- Fail-closed: unresolved service graph blocks startup.

9. Load persisted state.
- Fail-closed: corrupt unreadable state blocks startup.

10. Validate schema version and structure.
- Fail-closed: unsupported version blocks startup.

11. Validate inventory domain invariants.
- Fail-closed: critical invariant violations block startup.

12. Validate references using approved recovery policy.
- Fail-closed for mandatory reference invalidation; optional references handled by policy.

13. Rebuild derived projections deterministically.
- Fail-closed for critical projections; non-critical projection failures degrade health.

14. Register mission control observers.
- Fail-closed only if policy marks observation required for readiness; otherwise degrade health.

15. Mark runtime ready.
- Only after all required readiness gates pass.

Startup readiness gate set:

1. Schema compatible.
2. Canonical state load successful.
3. Critical invariants valid.
4. Mandatory references valid or explicitly recoverable.
5. Critical projections ready.
6. Command pipeline initialized.
7. Persistence coordinator healthy.