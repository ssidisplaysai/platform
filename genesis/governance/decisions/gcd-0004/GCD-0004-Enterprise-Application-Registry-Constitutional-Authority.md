# GCD-0004 Enterprise Application Registry Constitutional Authority

Decision ID: GCD-0004
Program: Genesis Constitutional Decisions
Type: Constitutional Governance Decision
Status: CERTIFIED
Lifecycle State: Published
Date: 2026-07-30
Authority: genesis/CONSTITUTION.md
Publication Class: Governance Publication Package

## Purpose

Establish the Enterprise Application Registry as the single authoritative operational registry for application discovery, identity, lifecycle, capability, ownership, and launch metadata across the Genesis Enterprise Operating System.

## Constitutional Authority

This decision derives authority from:
- genesis/CONSTITUTION.md
- GCD-0003 Genesis Application Boundary Model
- GACD-0005 Registry Authority Decision
- GACD-0006 Kernel Authority Decision
- GGS-0008 Constitutional Lifecycle Specification
- GGS-0009 Constitutional Authority Specification
- GGS-0010 Constitutional Dependency Specification
- Genesis Constitutional Decision Model
- Hall of Decisions

## Decision Statement

1. Genesis SHALL maintain exactly one authoritative Enterprise Application Registry for enterprise application discovery and launch governance metadata.
2. The Enterprise Application Registry SHALL be the authoritative source for application identity, ownership, lifecycle, capability, compatibility, health endpoint references, navigation metadata, and launch metadata.
3. Constitutional Registries SHALL remain reserved for constitutional artifacts and SHALL NOT store enterprise application runtime governance records.
4. Registry authority SHALL remain singular and explicitly owned.
5. This decision is governance-only and introduces no runtime implementation mutation.

## Constitutional Determinations (Primary Questions)

1. What information MUST every application register?
Every application MUST register the constitutional schema defined by EAR-0001 in this package.

2. Who owns registry authority?
Genesis Architecture and Runtime Authority owns constitutional authority for the Enterprise Application Registry unless superseded by explicit constitutional delegation.

3. Who may create entries?
Authorized registry stewards delegated by the authority owner may create entries after required approval.

4. Who may modify entries?
Authorized registry stewards may modify records only within their delegated authority and lifecycle rules.

5. Who may retire entries?
The authority owner or explicitly delegated retirement authority may retire records with governed approval and audit evidence.

6. What lifecycle governs application registration?
The registration lifecycle defined in EAR-0003 governs all records.

7. How does Genesis consume registry information?
Genesis consumes registry metadata to generate navigation, apply visibility policy, validate compatibility, and launch approved application targets.

8. How are registry changes audited?
All mutations require immutable audit events as specified by EAR-0005.

## Registry Scope

Authoritative scope includes:
- Application Identity
- Application Ownership
- Application Lifecycle
- Application Discovery
- Navigation Metadata
- Launch Metadata
- Capability Metadata
- Compatibility Metadata
- Health Endpoint References
- Version Metadata
- Authority Ownership
- Dependencies
- Governance Status

Excluded scope includes:
- Business data
- Customer data
- Application configuration internals
- Runtime execution state
- Secrets and credentials
- Business-domain ownership semantics

## Cross References

- GAF-0001-Genesis-Constitutional-Foundation-Freeze.md
- GCD-0003-Genesis-Application-Boundary-Model.md
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

Certified and published as constitutional authority for enterprise application registry governance.
