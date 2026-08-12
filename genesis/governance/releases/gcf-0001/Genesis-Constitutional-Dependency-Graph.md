# Genesis Constitutional Dependency Graph

Document ID: GCF-0001-DEPGRAPH
Date: 2026-07-30

## Dependency Hierarchy

1. genesis/CONSTITUTION.md
2. Genesis Governance Library and Authority Model
3. Certification and audit standards
4. Hall of Decisions and constitutional decisions
5. Registry and contract constitutional specifications
6. Publication baseline and freeze artifacts

## Decision Dependencies

- GCD-0002 depends on constitution and governance library authority chain.
- GCD-0003 depends on GAF-0001, GACD-0005, GACD-0006, lifecycle, authority, and dependency specifications.
- GCD-0004 depends on GCD-0003, GACD-0005, GACD-0006, lifecycle, authority, dependency, and decision model artifacts.
- GCD-0005 depends on GCD-0003, GCD-0004, EAR-0001, GACD-0005, GACD-0006, and decision model artifacts.

## Registry Dependencies

- Enterprise Application Registry authority depends on GCD-0004 and GACD-0005.
- Enterprise Health and Capability Contract depends on GCD-0005 and EAR identity alignment.
- Governance machine registry entries depend on Hall and constitutional decision artifacts.

## Authority Dependencies

Constitution
-> Governance Library
-> Standards
-> Procedures
-> Certification/Audit
-> Constitutional Decisions
-> Operational Governance

## Lifecycle Dependencies

Decision lifecycle and publication lifecycle govern all baseline artifacts:
- Draft/Proposed
- Review stages
- Certified/Published
- Frozen baseline release
- Supersession/retirement pathways

## Kernel Relationships

- Kernel authority remains constrained by GACD-0006.
- No enterprise contract artifact grants kernel ownership of application business logic.

## Shared Platform Relationships

Shared platform consumes governed metadata and contracts for aggregation, observability, and readiness reporting.

Shared platform does not own application domain semantics.

## Application Relationships

Applications relate to Genesis through:
- Registry identity and lifecycle
- Health/capability contract publication
- Compatibility declarations
- Permission-scoped visibility and launch metadata

## Circular Dependency Check

No circular constitutional authority dependency is introduced by GCF-0001 publication artifacts.

Dependencies remain top-down with governance authority precedence.
