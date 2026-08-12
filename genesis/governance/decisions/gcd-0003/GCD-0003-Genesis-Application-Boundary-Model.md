# GCD-0003 Genesis Application Boundary Model

Decision ID: GCD-0003
Program: Genesis Constitutional Decisions
Type: Constitutional Architecture Governance Decision
Status: CERTIFIED
Lifecycle State: Published
Date: 2026-07-30
Authority: genesis/CONSTITUTION.md
Publication Class: Governance Publication Package

## Purpose

Define the permanent constitutional boundary between Genesis as the Enterprise Operating System and independently deployable enterprise business applications.

This decision establishes stable operating-system responsibilities for Genesis while preserving bounded-context ownership for each application.

## Constitutional Authority

This decision derives authority from:
- genesis/CONSTITUTION.md
- GAF-0001 Architectural boundary doctrine
- GACD-0005 Registry authority doctrine
- GACD-0006 Kernel authority doctrine
- GGS-0008 Lifecycle doctrine
- GGS-0009 Authority hierarchy doctrine
- GGS-0010 Dependency direction doctrine
- Genesis Constitutional Decision Model
- Hall of Decisions

## Decision Statement

Genesis SHALL be the Enterprise Operating System.

Genesis SHALL NOT become the business applications it manages.

Genesis SHALL provide shared enterprise operating capabilities.

Business applications SHALL remain independently deployable bounded contexts with independent runtime and domain ownership.

Genesis SHALL discover, launch, govern, and observe applications through explicit contracts and authoritative registries.

## Guiding Principles

1. Boundary before convenience.
2. One authority owner per governed responsibility.
3. Coordination does not imply ownership.
4. Contract-first interoperability.
5. Lifecycle traceability is mandatory.
6. Dependency direction remains constitutionally upward.

## Architectural Boundaries

### Application Ownership Boundary
Applications own domain logic, user experience, internal APIs, data semantics, and release execution.

### Authentication Boundary
Until federation is adopted, applications may own local authentication.
Future SSO is a federated boundary service and does not absorb domain ownership.

### Deployment Boundary
Applications deploy independently and rollback independently.
Genesis deployment does not require simultaneous application deployment.

### Repository Boundary
Application code may exist in independent repositories or governed worktree partitions, but constitutional traceability and ownership must remain explicit.

### Runtime Boundary
Application runtimes remain independent.
Genesis runtime coordinates and observes through contracts and approved service interfaces.

### Database Boundary
Application domain data remains application-owned.
Genesis stores only shared platform governance and cross-application metadata.

### Cross-Application Communication Boundary
Cross-application communication SHALL use explicit versioned contracts.
Direct hidden coupling between applications is constitutionally prohibited.

### Plugin Boundary
Plugins are governed extensions registered through plugin governance and may not bypass authority boundaries.

## Application Ownership Rules

1. Every application SHALL have one declared authority owner.
2. Every application SHALL publish one identity and contract version.
3. Every application SHALL expose one governed health endpoint.
4. Every application SHALL publish lifecycle state to the enterprise registry.
5. Every application SHALL declare dependencies and compatibility policy.
6. Every application SHALL preserve bounded domain ownership.

## Genesis Responsibilities

Genesis SHALL provide:
- Enterprise navigation and launch surface
- Shared identity boundary and future SSO federation boundary
- Executive dashboards
- AI orchestration
- Shared notifications
- Shared observability aggregation
- Enterprise governance and policy traceability
- Enterprise Application Registry authority
- Enterprise Health Contract governance
- Company, user, audit, and plugin registry governance

Genesis SHALL NOT absorb application business logic ownership.

## Application Responsibilities

Each application SHALL own:
- Application user experience
- Application authentication until federation adoption
- Runtime and runtime operations
- Application APIs and API lifecycle
- Business logic and domain policies
- Release lifecycle and versioning
- Operational ownership and incident response

## Registry Responsibilities

Constitutional Registry scope remains constitutional artifacts only.

Application runtime metadata SHALL NOT be stored in Constitutional Registries.

Enterprise Application Registry SHALL be the authoritative registry for:
- Application discovery
- Launch metadata
- Integration contract pointers
- Lifecycle and compatibility metadata

Registry authority constraints:
- Exactly one authority owner per production registry
- Generated and cache views SHALL NOT become authority
- Applications consume approved registry APIs only

## Navigation Model

Genesis Mission Control SHALL present business-oriented navigation.

Navigation SHALL launch independent applications rather than embedding them as internal feature modules.

Navigation entries SHALL be sourced from Enterprise Application Registry metadata and authorization context.

## Health Model

Every registered application SHALL expose a governed health contract endpoint.

Genesis SHALL aggregate but not redefine application health ownership semantics.

Health minimum fields are defined in the Enterprise Health Contract proposal linked by this decision.

## Governance Model

Decision governance follows the Constitutional Decision Model and lifecycle controls.

Lifecycle and publication rules:
- State transitions are explicit and recorded
- Review and publication traceability is mandatory
- Supersession requires explicit successor mapping

## Future Evolution

Future changes may evolve:
- Federation profile for SSO
- Expanded compatibility semantics
- Plugin capability governance
- Additional registry indexes

Future changes SHALL NOT violate bounded-context ownership or kernel minimal-orchestration limits.

## Constitutional Implications

1. This decision formalizes Genesis as operating system authority, not monolithic application owner.
2. This decision preserves GACD-0006 kernel limits and forbids kernel ownership expansion into application domains.
3. This decision preserves GACD-0005 single-authority registry law.
4. This decision creates governance obligations for application registration, health contracts, and compatibility declarations.
5. This decision enables enterprise-scale expansion without constitutional authority inversion.

## Dependencies

- GAF-0001-Genesis-Constitutional-Foundation-Freeze.md
- GACD-0005-Registry-Authority-Decision.md
- GACD-0006-Kernel-Authority-Decision.md
- GGS-0008-Constitutional-Lifecycle-Specification.md
- GGS-0009-Constitutional-Authority-Specification.md
- GGS-0010-Constitutional-Dependency-Specification.md
- genesis/governance/certification/gccs-0001/Genesis-Constitutional-Decision-Model.md
- genesis/governance/decisions/hall/Hall-of-Decisions.md

## Supersession

Supersedes: None
Superseded By: None

## Disposition

Certified and published as constitutional governance authority for application boundary architecture.
