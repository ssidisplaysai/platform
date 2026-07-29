# 09 Canonical Entity Model

## Canonical Entity Set
1. Constitution
2. ConstitutionalClause
3. GovernanceAuthority
4. GovernanceDecision
5. ArchitectureStandard
6. Capability
7. CapabilityDomain
8. Program
9. Package
10. Artifact
11. Application
12. RuntimeSubsystem
13. KernelService
14. Registry
15. SemanticConcept
16. ValidationRule
17. ValidationRecord
18. CertificationRule
19. CertificationRecord
20. ReleaseRecord
21. Foundation
22. Owner
23. LifecycleState
24. Dependency
25. EvidenceSource
26. RepositoryLocation

## Required Entity Schema
Each entity instance shall include:
1. canonicalId
2. entityType
3. displayName
4. description
5. authorityLevel
6. lifecycleState
7. accountableOwner
8. constitutionalHome
9. sourceLocation
10. evidenceReferences
11. certificationState
12. validationState
13. metadataRequirementsStatus

## Identity And Merge Rules
1. canonicalId uniqueness is global within a compiled Atlas snapshot.
2. Merge preference follows source authority model and lifecycle recency.
3. Merge of conflicting authoritative entities with same canonicalId is fatal unless explicit override policy exists.

## Conflict Rules
1. Ownership conflict in authoritative entities: error or fatal by policy.
2. Constitutional home conflict in authoritative entities: fatal.
3. Lifecycle conflict with frozen record: fatal.
