# 09 - Identity Reference Architecture

## Overview
This reference architecture defines canonical identity flows without binding to provider-specific runtime implementation.

## 1) Identity Establishment
```mermaid
flowchart TD
  A[Identity Request] --> B[Identity Resolver Port]
  B --> C[Principal + Subject Creation]
  C --> D[Membership Resolver]
  D --> E[Audit Sink]
```

## 2) Authentication Flow
```mermaid
flowchart TD
  A[AuthenticationRequest] --> B[AuthenticationService Port]
  B --> C[CredentialVerifier Port]
  C -->|valid| D[AuthenticationContext]
  C -->|invalid| E[IdentityError INVALID_CREDENTIAL]
  D --> F[SessionService CreateSession]
  F --> G[AuthenticationResult]
  E --> G
```

## 3) Session Creation
```mermaid
flowchart TD
  A[Principal + Identity] --> B[SessionService]
  B --> C[SessionDescriptor]
  C --> D[Audit Record SESSION_CREATED]
```

## 4) Session Validation
```mermaid
flowchart TD
  A[Session Reference] --> B[SessionService Validate]
  B --> C{Valid?}
  C -->|Yes| D[SessionValidationResult valid=true]
  C -->|No| E[SessionValidationResult valid=false]
  E --> F[Error Code INVALID/EXPIRED/REVOKED_SESSION]
```

## 5) Authorization Decision
```mermaid
flowchart TD
  A[AuthorizationRequest] --> B[AuthorizationService]
  B --> C[PolicyResolver]
  B --> D[MembershipResolver]
  C --> E[Decision Engine]
  D --> E
  E --> F[AuthorizationDecision]
  F --> G[Audit Record AUTHORIZATION_EVALUATED]
```

## 6) Workspace Membership Resolution
```mermaid
flowchart TD
  A[PrincipalId + WorkspaceId] --> B[MembershipResolver]
  B --> C[MembershipDescriptor[]]
  C --> D[AuthorizationService]
```

## 7) Application Access
```mermaid
flowchart TD
  A[Protected UI/API] --> B[SessionService Validate]
  B --> C[AuthorizationService Authorize]
  C --> D{Allowed?}
  D -->|Yes| E[Business Handler]
  D -->|No| F[Forbidden/NotFound/Redirect]
```

## 8) External Identity Federation
```mermaid
flowchart TD
  A[External Assertion] --> B[IdentityProviderAdapter]
  B --> C[FederationReference]
  C --> D[Principal Mapping]
  D --> E[AuthenticationContext]
  E --> F[SessionService]
```

## 9) Service Identity Flow
```mermaid
flowchart TD
  A[Service Credential Reference] --> B[CredentialVerifier]
  B --> C[Service Identity Subject]
  C --> D[AuthorizationService]
  D --> E[Decision + Audit]
```

## 10) Audit Evidence Flow
```mermaid
flowchart TD
  A[Auth/Authz/Session Event] --> B[IdentityAuditSink]
  B --> C[Immutable Audit Record]
  C --> D[Certification Evidence]
```

## Architecture Constraints
- Identity authority is platform-owned.
- Authentication and authorization are separate contracts.
- Sessions are not identities.
- Credential values are not exposed in public contracts.
- All critical decisions are auditable.
