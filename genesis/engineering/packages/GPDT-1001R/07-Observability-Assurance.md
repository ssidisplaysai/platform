# 07 Observability Assurance

Audit assurances:

1. Successful mutations append audit records.
2. Rejected version conflict and reference-failure paths append rejection audit evidence.

Metrics assurances:

1. Metrics reflect current canonical state counts.
2. recoveryCount increments on successful load/recovery.
3. invalidReferenceCount increments on mandatory reference failures.
4. versionConflictCount increments on lifecycle concurrency/version mismatch failures.
5. invariantViolationCount and providerConflictCount support are present in metrics model.

Health assurances:

1. Health snapshot is observational and non-mutating.
2. Health includes persistence, provider-registry, invariant, references, audit, and integration-ports checks.

Mission Control assurances:

1. Observation payload includes health and metrics only.
2. Observation path cannot mutate Product state.
3. Duplicate observer registration is deterministic.
4. Duplicate provider registration remains deterministic.
