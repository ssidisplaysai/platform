# Business Genome Versioning Model

## Versioning Mission
Define deterministic version transitions for canonical entities, relationships, evidence, and provenance.

## Version Dimensions
- modelVersion
- objectVersion
- policyVersion
- evidenceVersion
- provenanceVersion

## Version States
- DRAFT
- REVIEWED
- APPROVED
- ACTIVE
- DEPRECATED
- RETIRED

## Version Transition Rules
1. DRAFT -> REVIEWED requires completeness check.
2. REVIEWED -> APPROVED requires constitutional review sign-off.
3. APPROVED -> ACTIVE requires certification gate approval.
4. ACTIVE -> DEPRECATED requires governed successor definition.
5. DEPRECATED -> RETIRED requires dependency impact attestation.

## Determinism Requirements
- Version identifiers are monotonic within authority scope.
- Transition records are immutable and auditable.
- Rollback creates a new version event and does not mutate historical records.

## Cross-References
- Business-Genome-Invariants.md
- Business-Genome-Ownership-Matrix.md
- Certification-Checklist.md
