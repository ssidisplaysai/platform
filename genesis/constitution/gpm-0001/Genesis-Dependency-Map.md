# Genesis Dependency Map

## Critical Dependency Graph
1. GWS-03 Genesis Kernel -> GWS-04 Enterprise Runtime
2. GWS-03 Genesis Kernel -> GWS-05 Enterprise Registries
3. GWS-04 Enterprise Runtime -> GWS-01 GAR Engine
4. GWS-05 Enterprise Registries -> GWS-02 Business Genome
5. GWS-04 Enterprise Runtime -> GWS-07 AI Agent Framework
6. GWS-07 AI Agent Framework -> GWS-06 Applications
7. GWS-08 Automation -> GWS-06 Applications
8. GWS-09 Observability -> GWS-01 GAR Engine
9. GWS-11 Deployment -> GWS-06 Applications

## Blocked Dependencies
- D-BLK-001: release metadata commit binding required before RW-3 package approvals.
- D-BLK-002: lineage evidence expansion required for GAR checkpoint confidence uplift.
- D-BLK-003: architecture lineage graph binding required for full traceability assurance.

## Dependency Control Policy
1. Hard dependencies must be closed before milestone exit.
2. Soft dependencies require explicit risk acceptance when deferred.
3. Any critical-path variance greater than one reporting cycle escalates to PMO and ARB.

## Constitutional Dependency Policy Authority
- Governing decision: GACD-0002
- Policy artifact: GACD-0002-Genesis-Dependency-Policy.md
- Bootstrap boundary decision: GACD-0003
- Bootstrap policy artifact: GACD-0003-Platform-Bootstrap-API-Decision.md
- Authority source: genesis/CONSTITUTION.md
