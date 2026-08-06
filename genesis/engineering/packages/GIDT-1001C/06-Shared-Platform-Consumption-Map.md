# 06 Shared Platform Consumption Map

Consumption rule:

- Inventory consumes shared certified mechanics and layers Inventory semantics above them. Inventory does not duplicate shared mechanics, and shared does not absorb Inventory business rules.

Shared component consumption matrix:

1. RuntimeHost
- Inventory use case: process host lifecycle for inventory runtime.
- Adapter/composition point: runtime composition root host bootstrap.
- Inventory semantics above: inventory startup readiness gates.
- Extension: inventory runtime plugin registration.
- Failure behavior: host initialization failure blocks startup.
- Prohibited use: business rule execution in host.
- Testing responsibility: runtime boot integration tests.
- Fallback: fail closed, runtime not ready.

2. LifecycleManager
- Use case: deterministic start and stop ordering.
- Composition: runtime lifecycle registration.
- Semantics above: inventory-specific pre-ready checks.
- Extension: lifecycle hooks for projection rebuild and validator warmup.
- Failure: stop/start errors classified and surfaced.
- Prohibited: bypassing lifecycle transitions.
- Testing: lifecycle transition and stop failure taxonomy tests.
- Fallback: fail closed with explicit health degraded state.

3. ServiceRegistry
- Use case: register inventory services and handlers.
- Composition: runtime service registration phase.
- Semantics above: ownership-tagged service discovery.
- Extension: inventory service descriptors.
- Failure: missing dependency blocks startup.
- Prohibited: dynamic mutation of critical services after ready.
- Testing: dependency graph registration tests.
- Fallback: fail closed, startup aborted.

4. ProviderRegistry
- Use case: register reference validators and projection providers.
- Composition: integration bootstrap phase.
- Semantics: validator authority per reference type.
- Extension: provider capability metadata.
- Failure: mandatory provider missing blocks startup.
- Prohibited: provider direct state mutation.
- Testing: provider resolution tests.
- Fallback: fail closed for mandatory providers.

5. FileStore
- Use case: file-backed inventory state persistence.
- Composition: persistence adapter initialization.
- Semantics: state-file partitioning policy and naming.
- Extension: tenant-partitioned store paths.
- Failure: read/write failure rejects mutation and degrades health.
- Prohibited: bypassing PersistenceCoordinator.
- Testing: file I/O failure and corruption-path tests.
- Fallback: fail closed for canonical writes.

6. PersistenceCoordinator
- Use case: coordinated atomic persistence for movement, balances, and idempotency records.
- Composition: service transaction orchestration.
- Semantics: inventory atomicity contract.
- Extension: inventory transaction participants.
- Failure: any participant failure aborts mutation.
- Prohibited: partial commit acceptance.
- Testing: no-partial-mutation tests.
- Fallback: fail closed and preserve pre-mutation state.

7. SchemaValidator
- Use case: validate persisted inventory schema version and structure.
- Composition: startup load and write precondition.
- Semantics: inventory schema compatibility policy.
- Extension: inventory schema descriptor and migration gate.
- Failure: unsupported schema blocks startup.
- Prohibited: best-effort load of incompatible schema.
- Testing: unsupported schema rejection tests.
- Fallback: fail closed.

8. RecoveryCoordinator
- Use case: recover from persisted state and rebuild projections.
- Composition: startup recovery stage.
- Semantics: inventory recovery policies.
- Extension: inventory recovery validators.
- Failure: unrecoverable corruption blocks startup.
- Prohibited: silent repair that loses canonical facts.
- Testing: corruption and deterministic recovery tests.
- Fallback: fail closed with recovery error classification.

9. HealthService
- Use case: publish inventory health contributors.
- Composition: observability bootstrap.
- Semantics: inventory health dimensions.
- Extension: health probes for references, invariants, persistence.
- Failure: degraded health status; runtime may remain up if safe.
- Prohibited: health writes mutating inventory state.
- Testing: health classification tests.
- Fallback: health unknown becomes degraded.

10. MetricsService
- Use case: emit inventory counters and rates.
- Composition: observability registration.
- Semantics: inventory metric taxonomy.
- Extension: inventory metric names and labels.
- Failure: metrics failure increments internal error counter, never bypasses command validation.
- Prohibited: control flow decisions based solely on metric emission success.
- Testing: emission and fallback tests.
- Fallback: best effort emit, no state mutation rollback unless configured as strict compliance.

11. AuditService
- Use case: immutable audit evidence capture.
- Composition: command result hooks.
- Semantics: inventory audit reason taxonomy.
- Extension: inventory audit enrichers.
- Failure: if compliance mode strict, mutation fails; otherwise degraded audit health with alert.
- Prohibited: mutable audit rewrite.
- Testing: audit strict/non-strict mode tests.
- Fallback: configurable fail closed default for regulated commands.

12. ObserverRegistry
- Use case: register mission-control observation providers.
- Composition: late startup after projection rebuild.
- Semantics: read-only observation contracts.
- Extension: inventory observation channels.
- Failure: observation provider failure degrades observability only.
- Prohibited: observer-driven mutation commands.
- Testing: observer registration and isolation tests.
- Fallback: runtime continues with degraded observation state.

13. ObservationPublisher
- Use case: publish inventory observations to mission control.
- Composition: post-command and scheduled publication hooks.
- Semantics: inventory observation payload shape.
- Extension: inventory observation topics.
- Failure: publication failure increments metric and audit event.
- Prohibited: mutation authority in observer channel.
- Testing: publication failure path tests.
- Fallback: queued retry according to policy, canonical state unaffected.

14. InvariantEngine
- Use case: evaluate inventory invariants deterministically.
- Composition: pre-commit mutation checks and startup invariant validation.
- Semantics: inventory-owned invariant rule set.
- Extension: inventory invariant registration.
- Failure: invariant failure rejects mutation or blocks startup when critical.
- Prohibited: shared-owned business invariants.
- Testing: invariant rule coverage tests.
- Fallback: fail closed.

15. CommonValidators
- Use case: shared structural validation primitives.
- Composition: command validation pipeline.
- Semantics: inventory composes domain-specific checks above common validators.
- Extension: inventory validator composition wrappers.
- Failure: validation errors reject command.
- Prohibited: replacing inventory semantics with generic validators.
- Testing: validation chain tests.
- Fallback: fail closed.

16. deterministic utilities
- Use case: deterministic ordering for persistence serialization, projection rebuild ordering, and conflict resolution tie-breakers.
- Composition: persistence write and replay paths.
- Semantics: inventory chooses where deterministic order is behavior-affecting.
- Extension: inventory comparator registration only by usage.
- Failure: comparator mismatch triggers deterministic-validation failure.
- Prohibited: locale-dependent ordering.
- Testing: deterministic ordering tests.
- Fallback: fail closed when deterministic guarantees cannot be met.

17. semantic-version utilities
- Use case: schema version comparison during startup and migration gate checks.
- Composition: schema validation pipeline.
- Semantics: inventory compatibility matrix.
- Extension: inventory-supported version range policy.
- Failure: unsupported version blocks startup.
- Prohibited: permissive unknown-version loading.
- Testing: version compatibility tests.
- Fallback: fail closed.

18. normalization utilities
- Use case: bounded normalization for external contract ingress where lossy behavior is disallowed.
- Composition: reference and command boundary adapters.
- Semantics: inventory disallows universal serializer behavior.
- Extension: inventory explicit normalization profiles per command.
- Failure: unsupported or lossy normalization rejects input.
- Prohibited: universal serializer normalization for canonical domain state.
- Testing: unsupported/lossy normalization tests.
- Fallback: reject command.

19. shared testing utilities
- Use case: future runtime tests may consume shared fixtures and harnesses.
- Composition: test phase only, not runtime.
- Semantics: inventory-specific assertions remain local.
- Extension: inventory test helpers.
- Failure: utility mismatch blocks test, not runtime.
- Prohibited: runtime dependency on test utilities.
- Testing: N/A in this documentation package.
- Fallback: local inventory test harness substitution in implementation phase.