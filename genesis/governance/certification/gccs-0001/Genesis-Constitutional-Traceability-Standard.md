# Genesis Constitutional Traceability Standard

## Mandatory Traceability Fields For Every Certification Decision
- Constitutional clauses
- Evidence identifiers
- Standards references
- Procedures references
- Affected artifact identifiers
- Supporting document references
- Machine identifiers
- Lifecycle identifiers
- Supersession relationships

## Traceability Constraints
1. Every required clause must map to at least one admissible evidence item.
2. Every decision must map to a machine-readable decision registry entry.
3. Every superseded decision must map to a successor decision identifier.
4. Traceability edges for authority must remain acyclic.

## Machine Reference
- [machine/traceability-graph.json](machine/traceability-graph.json)
- [machine/authority-graph.json](machine/authority-graph.json)
- [machine/certification-registry.schema.json](machine/certification-registry.schema.json)