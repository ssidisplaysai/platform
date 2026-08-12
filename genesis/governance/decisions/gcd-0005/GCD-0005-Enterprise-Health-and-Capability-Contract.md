# GCD-0005 Enterprise Health & Capability Contract

Decision ID: GCD-0005
Program: Genesis Constitutional Decisions
Type: Constitutional Governance Decision
Status: CERTIFIED
Lifecycle State: Published
Date: 2026-07-30
Authority: genesis/CONSTITUTION.md
Publication Class: Governance Publication Package

## Purpose

Establish the constitutional contract governing how every Genesis application reports health, capabilities, compatibility, readiness, liveness, lifecycle state, and operational status to Genesis Enterprise Operating System.

## Constitutional Authority

This decision derives authority from:
- genesis/CONSTITUTION.md
- GCD-0003 Genesis Application Boundary Model
- GCD-0004 Enterprise Application Registry Constitutional Authority
- EAR-0001 Enterprise Application Registry Specification
- GACD-0005 Registry Authority Decision
- GACD-0006 Kernel Authority Decision
- Genesis Constitutional Decision Model
- Hall of Decisions

## Decision Statement

1. Every registered Genesis application SHALL expose a standard Enterprise Health and Capability Contract.
2. Genesis SHALL consume this contract for enterprise aggregation, observability, launch readiness, compatibility validation, and governance reporting.
3. Genesis SHALL NOT inspect application internal state outside this contract.
4. Applications remain authoritative for their own operational semantics and business logic.
5. Genesis remains authoritative for enterprise-level aggregation and governance interpretation.

## Primary Determinations

1. What SHALL every Genesis application expose?
A governed contract payload conforming to EHC-0001, EHC-0002, EHC-0003, EHC-0004, and EHC-0005.

2. What constitutes a healthy application?
Status Healthy with readiness Ready and liveness Alive, with compatible contract and version declarations.

3. What constitutes readiness?
Readiness states defined by EHC-0003 with transition governance and activation controls.

4. How are degraded states represented?
Status Degraded and Warning states with explicit severity semantics and enterprise reporting behavior.

5. How are maintenance states represented?
Status Maintenance with maintenanceMode true and governed readiness/liveness implications.

6. How are capabilities advertised?
Capability declarations SHALL follow EHC-0002 identifiers, versioning, lifecycle, and deprecation metadata.

7. How is Genesis compatibility declared?
Through supportedGenesisVersion, compatibilityStatus, contractVersion, and API version compatibility rules in EHC-0004.

8. How are contract versions managed?
By semantic version governance and compatibility windows in EHC-0005.

9. How are breaking changes governed?
Breaking changes require constitutional approval and published migration guidance before activation.

10. How are health contracts audited?
Through immutable audit records defined by EHC-0007.

## Cross References

- GCD-0003-Genesis-Application-Boundary-Model.md
- GCD-0004-Enterprise-Application-Registry-Constitutional-Authority.md
- EAR-0001-Enterprise-Application-Registry-Specification.md
- GACD-0005-Registry-Authority-Decision.md
- GACD-0006-Kernel-Authority-Decision.md
- genesis/governance/certification/gccs-0001/Genesis-Constitutional-Decision-Model.md
- genesis/governance/decisions/hall/Hall-of-Decisions.md

## Supersession

Supersedes: None
Superseded By: None

## Disposition

Certified and published as constitutional authority for enterprise health and capability contract governance.
