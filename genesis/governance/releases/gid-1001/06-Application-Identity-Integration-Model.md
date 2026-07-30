# 06 - Application Identity Integration Model

## Purpose
Define how Genesis applications consume identity capabilities while preserving platform-owned identity authority.

## Integration Flow
1. Application registers in EAR with identity capability declarations.
2. Application advertises identity health participation via EHC.
3. Application consumes platform identity contracts for authentication/session/authorization.
4. Mission Control consumes resulting access capabilities for governed navigation and route access.

## Registration Through EAR
Applications must declare:
- identity dependency requirement
- required permission namespaces
- workspace/membership dependencies
- supported contract versions

EAR records declarations; it does not establish identity authority.

## Identity Capability Declaration
Each application declares:
- authentication methods requested
- session validation mode
- authorization request patterns
- policy owner scope
- audit obligations

## EHC Identity Health Participation
Applications publish identity integration health indicators:
- provider adapter reachability
- session validation health
- authorization evaluation latency
- audit sink availability

## Mission Control Access Integration
- Mission Control consumes policy outcomes and capability signals.
- Mission Control does not create identities or policies.
- Route visibility remains policy-governed by platform decisions.

## Protected UI Integration
- UI routes request authorization decisions via platform contracts.
- Denied decisions produce safe user flow (redirect/not found/disabled controls).
- UI logic must not become identity authority.

## Protected API Integration
- API handlers perform session validation and authorization via platform service ports.
- Missing or invalid session returns unauthorized.
- Policy denial returns forbidden with safe message.

## Workspace Selection
- Identity contracts support workspace-scoped membership and policy evaluation.
- Workspace selection and switching are governed by active memberships.

## Application Permission Namespaces
- Applications own business permission identifiers.
- Platform evaluates permissions without owning business semantics.

## Business-Owned Policies
- Business domains define policy intent and lifecycle.
- Platform authorization service executes deterministic evaluation.

## Platform-Owned Identity Establishment
- Principal/identity/session lifecycle remains platform-owned.
- Applications consume identity results; they do not mint principals.

## Migration Compatibility
- Existing GLW auth path remains a compatibility implementation.
- Future migration introduces identity adapters without breaking current user flows.

## Failure Behavior
- Provider unavailable: retry-safe degraded mode signaling.
- Session invalid/expired: re-authentication flow.
- Policy denied: deterministic deny with auditable reason.
- Contract mismatch: version negotiation and rollback path.

## GLW Compatibility Reference
GLW is the first compatibility reference for migration sequencing only. GLW-specific behavior does not define canonical identity authority architecture.
