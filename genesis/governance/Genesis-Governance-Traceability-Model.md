# Genesis Governance Traceability Model

## Traceability Requirement
Every governance document must define:
- Authority source
- Constitution references
- Related standards
- Related procedures
- Implementation consumers
- Certification consumers
- Audit consumers
- Evidence consumers

## Traceability Constraints
- Traceability must be directional and acyclic for authority edges.
- Cross-reference edges may be cyclic but cannot imply authority override.
- All certification outcomes must reference evidence and governing standards.

## Machine References
- [machine/cross-reference-graph.json](machine/cross-reference-graph.json)
- [machine/dependencies.json](machine/dependencies.json)
- [machine/supersession-model.json](machine/supersession-model.json)