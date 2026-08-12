# Enterprise Application Registry Proposal

Artifact ID: GCD-0003-EAR-0001
Decision Parent: GCD-0003
Status: PROPOSED
Lifecycle State: Draft
Authority: Genesis Architecture and Runtime Authority
Owner: Enterprise Operating System Governance

## Purpose

Define the authoritative registry for enterprise application discovery, launch metadata, lifecycle metadata, and compatibility metadata.

## Authority

The Enterprise Application Registry is an operational governance registry under Genesis operating-system governance.

It is not a Constitutional Registry and does not carry constitutional artifact authority.

## Ownership

One authority owner SHALL be declared for the Enterprise Application Registry.

Allowed owner class:
- Genesis Architecture and Runtime Authority or an explicitly delegated registry authority approved by constitutional governance.

## Schema

Minimum record contract:
- applicationId
- name
- company
- version
- status
- publicUrl
- healthEndpoint
- navigationMetadata
- capabilities
- permissions
- dependencies
- lifecycleState
- compatibilityVersion
- authorityOwner
- lastSeen
- registeredServices

## Lifecycle

Registry record lifecycle:
- Proposed
- Registered
- Activated
- Validated
- Deprecated
- Retired

Lifecycle transitions SHALL be explicit and auditable.

## Validation Rules

1. applicationId must be globally unique in registry scope.
2. Exactly one authorityOwner per record.
3. publicUrl and healthEndpoint must be syntactically valid and reachable per operational policy.
4. dependencies must be explicit and acyclic.
5. compatibilityVersion must be present before activation.
6. lifecycle transitions must preserve audit traceability.

## Allowed Metadata

- Identity metadata
- Discovery metadata
- Navigation metadata
- Capability metadata
- Permission references
- Compatibility metadata
- Lifecycle metadata
- Ownership metadata
- Dependency metadata

## Explicit Exclusions

The registry SHALL NOT store:
- Constitutional artifact publication state
- Constitutional authority hierarchy definitions
- Application business data
- Application internal secrets
- Runtime-internal cache state as authority truth

## Relationship to Constitutional Registries

Constitutional Registries govern constitutional artifacts and their publication standing.

Enterprise Application Registry governs operational application metadata for discovery and launch.

These two registry surfaces are complementary and shall remain separate by constitutional boundary law.
