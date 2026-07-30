# 03 - Identity Authority Boundaries

## Boundary Objective
Define unambiguous ownership across identity establishment, authorization, membership, audit, and federation.

## Responsibility Allocation

### Genesis Identity Platform
- Establishes canonical principals and identity subjects.
- Issues and validates platform session descriptors.
- Executes authentication contracts and authorization contracts.
- Stores identity audit evidence.
- Hosts provider adapters and federation-link authority.

### Applications (GLW, SSI, STONER, RJ Metal, future apps)
- Own business-domain permission namespaces and policy intent.
- Request identity and authorization decisions from platform services.
- Must not become independent identity authority.

### Enterprise Application Registry (EAR)
- Registers application identity capability declarations.
- Does not establish user identity or evaluate auth decisions.

### Enterprise Health Platform (EHC)
- Publishes health/readiness of identity-participating services.
- Does not establish identity or issue authorization decisions.

### Mission Control (GMC)
- Consumes platform authorization outcomes for routing/visibility.
- Does not mint identities or validate credentials directly.

### External Identity Providers
- Validate external credentials when adapter-enabled.
- Do not own Genesis principal lifecycle.

### Business-domain Policy Owners
- Define policy and permission intent for their domain.
- Do not bypass platform authorization service for enforcement.

## Explicit Ownership Matrix
- Who establishes identity: Genesis Identity Platform.
- Who validates credentials: Identity provider adapters under platform authority.
- Who creates sessions: Platform session service.
- Who owns roles: Business-domain policy owners with platform contract governance.
- Who owns permissions: Application/business namespace owners.
- Who evaluates policies: Platform authorization service.
- Who owns workspace membership: Shared model; platform records and enforces, business owners approve intent.
- Who records authorization evidence: Platform identity audit sink.
- Who may revoke access: Platform service under policy and governance controls.
- Who may delegate access: Authorized business policy owners through governed grant model.
- Who may federate external identities: Platform federation authority via provider adapters.

## Prohibited Ownership Patterns
- Application-level identity stores acting as independent authority.
- Direct credential validation inside application modules.
- Session issuance by non-platform application code.
- Permission enforcement bypassing platform authorization contracts.
- Identity or session claims embedded as implicit UI-only trust.
- External provider identity becoming canonical principal source without platform mapping.

## Boundary Constraints
- Authentication and authorization remain separate responsibilities.
- Session is transport continuity, not identity authority.
- Roles and permissions are entitlements, not identity primitives.
- Temporary compatibility paths must have explicit migration retirement targets.

## Certified Boundary Preservation
No boundary in this document authorizes redesign of certified GPR-1.0 services. This document defines future identity authority integration constraints only.
