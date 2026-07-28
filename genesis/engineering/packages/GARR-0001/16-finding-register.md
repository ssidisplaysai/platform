# 16 Finding Register

## Findings

| Finding ID | Severity | Area | Summary | Affected Artifacts | Owner | Blocking |
|---|---|---|---|---|---|---|
| FR-001 | MAJOR | Responsibility/Boundary/Interface/Traceability | Constitutional Services pillar is referenced but not represented as first-class manifest family registration rows. | genesis/architecture/ARCHITECTURE_MANIFEST.md, genesis/compiler/GCS-0001.md, package manifests referencing Constitutional Services | Architecture Governance + Engineering Governance | Yes |
| FR-002 | MAJOR | Dependency Architecture | Authoritative architecture sources explicitly record unresolved conceptual-loop and dual-surface dependency tension. | genesis/architecture/GENESIS_DEPENDENCY_MAP.md, genesis/architecture/SPRINT-0.5-ARCHITECTURE-CONSOLIDATION-REPORT.md | Architecture Governance | Yes |
| FR-003 | MAJOR | Lifecycle and Terminology Consistency | Manifest lifecycle/status vocabulary is materially over-fragmented (51 unique values), reducing audit-grade state consistency. | genesis/architecture/ARCHITECTURE_MANIFEST.md, STATUS.md | Architecture Governance | Yes |
| FR-004 | MAJOR | Decision Traceability | Core ADR set remains proposed and intentionally unapproved in authoritative consolidation report while major boundaries depend on those decisions. | genesis/architecture/SPRINT-0.5-ARCHITECTURE-CONSOLIDATION-REPORT.md, genesis/architecture/decisions.md | Architecture Review Board | Yes |
| FR-005 | EDITORIAL | Documentation Quality | Duplicate tag claim value appears in sampled claim set and should be normalized in future documentation cleanup. | genesis/architecture/ARCHITECTURE_MANIFEST.md | Architecture Governance | No |

## Severity Summary
- CRITICAL: 0
- MAJOR: 4
- MINOR: 0
- EDITORIAL: 1
- OBSERVATION: 0

## Readiness Effect
Open MAJOR findings require disposition ARCHITECTURE NOT READY.