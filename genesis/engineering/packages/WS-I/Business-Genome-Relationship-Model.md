# Business Genome Relationship Model

## Relationship Contract
Relationships are deterministic, directed, typed links between canonical entities with explicit authority, evidence, and provenance.

## Relationship Core Attributes
- relationshipId
- relationshipType
- sourceEntityId
- targetEntityId
- direction
- semanticMeaning
- authorityOwner
- evidenceRefs
- provenanceRef
- canonicalVersion
- lifecycleState

## Allowed Canonical Relationship Types
| Relationship Type | Source | Target | Meaning |
|---|---|---|---|
| owns | Organization | Asset, Facility, Document, Policy, Procedure, Process, Capability | Ownership authority |
| offers | Organization, Vendor | Product, Service | Offering authority |
| buys | Customer | Product, Service | Consumption authority |
| supplies | Vendor | Product, Service | Supply authority |
| performs | Employee, Role | Procedure, Process, Capability, Service | Execution responsibility |
| governs | Policy | Procedure, Process, Capability, Document | Normative control |
| evidences | Evidence | Any canonical entity or relationship | Evidentiary support |
| traces | Provenance | Evidence, Entity, Relationship | Lineage trace |
| dependsOn | Process, Capability, Service | Process, Capability, Service | Dependency contract |
| locatedAt | Asset, Employee, Service | Facility | Location boundary |

## Relationship Determinism Rules
1. Relationship identifiers are deterministic for equal normalized inputs.
2. Direction reversal creates a different relationship identity.
3. Relationship type cannot change without version transition.
4. Relationship evidence/provenance must be present before state becomes active.

## Non-Goals
- No graph runtime implementation.
- No query engine design.
- No indexing strategy.

## Cross-References
- Business-Genome-Entity-Model.md
- Business-Genome-Evidence-Model.md
- Business-Genome-Provenance-Model.md
- Business-Genome-Invariants.md
