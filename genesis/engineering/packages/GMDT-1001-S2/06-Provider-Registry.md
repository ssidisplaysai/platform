# 06 Provider Registry

Mechanical provider capabilities registered:
- manufacturing.runtime.clock
- manufacturing.runtime.identifier
- manufacturing.runtime.tenant-context
- manufacturing.runtime.metadata
- manufacturing.runtime.audit-sink
- manufacturing.runtime.observation-sink
- manufacturing.runtime.correlation

Rules enforced:
- Duplicate provider registration rejects.
- Missing required provider blocks readiness.
- Deterministic listing by provider identifier.
- No hidden fallback provider behavior.
