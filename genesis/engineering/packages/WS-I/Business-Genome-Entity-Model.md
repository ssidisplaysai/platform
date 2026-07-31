# Business Genome Entity Model

## Entity Modeling Rules
- Every entity has one canonical identifier.
- Every entity has one authority owner.
- Every entity includes lifecycle state and version identity.
- Every entity must support evidence and provenance linkage.
- No entity may duplicate authority of another entity.

## Canonical Entity Catalog
| Entity | Primary Purpose | Canonical Identity Basis | Required Ownership Scope |
|---|---|---|---|
| BusinessIdentity | Global identity anchor for business objects | Deterministic business identity key | Enterprise Governance |
| Organization | Legal/operating organizational authority | Organization identity key | Enterprise Governance |
| Product | Sellable or manufacturable offering definition | Product identity key | Commerce + Manufacturing |
| Service | Contracted service capability definition | Service identity key | Service Governance |
| Customer | External demand-side party authority | Customer identity key | Commerce |
| Vendor | External supply-side party authority | Vendor identity key | Supply Chain Governance |
| Employee | Internal workforce identity contract | Employee identity key | HR Governance |
| Role | Responsibility and permission grouping contract | Role identity key | Governance + Identity |
| Asset | Owned/managed physical or digital asset | Asset identity key | Operations |
| Facility | Physical operational location and boundary | Facility identity key | Operations |
| Document | Controlled business artifact contract | Document identity key | Documentation Governance |
| Policy | Normative control contract | Policy identity key | Governance |
| Procedure | Prescribed action sequence contract | Procedure identity key | Governance + Operations |
| Process | Business flow authority contract | Process identity key | Operations + Governance |
| Capability | Declared business ability contract | Capability identity key | Architecture Governance |
| Evidence | Source-supporting claim artifact | Evidence identity key | Evidence Governance |
| Provenance | Trace chain for canonical claims | Provenance identity key | Audit + Governance |

## Required Common Attributes
- identityId
- canonicalType
- canonicalVersion
- lifecycleState
- ownerId
- governanceScope
- evidenceRefs
- provenanceRef
- createdAt
- effectiveFrom
- effectiveTo
- status

## Entity Authority Constraints
1. Organization owns organization-scoped policy context.
2. Product and Service cannot own customer identity authority.
3. Customer and Vendor authorities cannot be merged into a single canonical type.
4. Employee identity authority is separate from Role authority.
5. Document is an artifact authority, not a policy authority.

## Cross-References
- Business-Genome-Identity-Model.md
- Business-Genome-Versioning-Model.md
- Business-Genome-Invariants.md
- Business-Genome-Ownership-Matrix.md
