# 05 - Identity Trust and Security Model

## Trust Boundaries
- Client boundary: untrusted input surface.
- Application boundary: consumer of identity contracts, not identity authority.
- Identity platform boundary: trusted authority for principal/session/authz decisions.
- Provider boundary: external trust domain mediated by adapter contracts.
- Audit boundary: append-only evidence authority.

## Credential Handling Principles
- Credentials are verification artifacts, not identity records.
- Public contracts carry credential references only.
- Secret values remain isolated to provider-verifier implementations.
- Credential validation outcomes are normalized to stable machine codes.

## Session Security
- Sessions are time-bounded continuity descriptors.
- Session issuance must bind to authentication context evidence.
- Session revocation and expiration are first-class outcomes.
- Session identifiers require replay-resistant validation strategies.

## Token Handling Principles
- Opaque or signed token material is implementation-specific and out of scope for GID-1001.
- Contract layer exposes only token/session references.
- Token claims are never accepted as identity authority without platform validation.

## Secret Isolation
- No secret material in contract payloads.
- No provider secrets in logs or client-safe messages.
- No secret-derived fields in deterministic decision payloads.

## Replay Protection
- Identity services must support nonce/time-bound validation patterns.
- Session validation contracts include explicit invalid/expired/revoked outcomes.
- Audit records must carry correlation and causation identifiers.

## Revocation and Expiration
- Credentials, sessions, and memberships support independent revocation.
- Revocation precedence supersedes allow decisions.
- Expired state is deterministic and non-retryable without renewal.

## Rotation
- Provider keys and credential references require rotational compatibility.
- Contract versions must support additive key metadata without breaking consumers.

## Least Privilege and Default Deny
- Authorization evaluation defaults to deny when policy is absent.
- Grants must be minimal and scoped by workspace/resource/action.
- Elevated permissions require explicit policy ownership.

## Policy Explainability
- Authorization decisions require stable reason codes and policy linkage.
- Denial outcomes must be explainable without leaking sensitive internals.

## Auditability
- Authentication, session, authorization, policy, and federation events are auditable.
- Audit records are immutable and traceable across services.

## Service-to-Service Identity
- Service identities are first-class principals.
- Service actors must never bypass policy evaluation.
- Delegation and impersonation require explicit governed evidence.

## Agent Identity
- Agents operate under dedicated agent principals.
- Autonomous actions must be attributable and reviewable.
- Agent identity scope must remain least privilege.

## External Provider Trust
- Providers are mediated by adapters; they are not direct principal authorities.
- External subject mappings require federation link governance.
- Provider outages map to explicit recoverable error classes.

## Federation Risks
- Account-link collisions.
- External-claim drift.
- Replay and stale assertion reuse.
- Provider lock-in and contract mismatch.

## Threat Assumptions
- Malicious credential replay attempts.
- Session theft attempts.
- Privilege escalation attempts.
- Policy bypass attempts via application-local checks.
- Misconfigured provider adapters.

## Security Invariants
- Identity is platform-owned.
- Authentication and authorization remain separate contracts.
- Sessions, credentials, roles, and permissions are not identity substitutes.
- Default-deny policy is preserved.
- Every critical identity decision is auditable.
