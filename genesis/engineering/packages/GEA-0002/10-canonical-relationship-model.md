# 10 Canonical Relationship Model

## Required Relationship Classes
1. Capability -> Capability
2. Capability -> Package
3. Package -> Artifact
4. Artifact -> ConstitutionalDecision
5. Program -> Capability
6. Application -> PlatformCapability
7. Capability -> Runtime
8. Capability -> Governance
9. Capability -> Validation
10. Capability -> Certification

## Additional Required Classes Where Evidence Exists
1. Constitution -> GovernanceAuthority
2. ConstitutionalClause -> Capability
3. GovernanceDecision -> Program
4. Program -> Package
5. Package -> Package
6. Artifact -> Artifact
7. Package -> ReleaseRecord
8. Package -> CertificationRecord
9. Package -> ValidationRecord
10. Capability -> Owner
11. Program -> Owner
12. Package -> Owner
13. Artifact -> Package
14. Application -> Package
15. RuntimeSubsystem -> Capability
16. SemanticConcept -> Capability
17. SemanticConcept -> Artifact
18. Foundation -> Package
19. EvidenceSource -> Entity
20. EvidenceSource -> Relationship

## Required Relationship Schema
Each relationship instance shall include:
1. relationshipId
2. sourceNodeId
3. targetNodeId
4. relationshipType
5. direction
6. cardinality
7. authorityClassification
8. lifecycleState
9. ownershipContext
10. evidenceReference
11. sourceLocation
12. derivationMethod
13. confidenceClassification
14. validationStatus
15. certificationRelevance
16. impactRelevance
