# 04 - Identity Error Taxonomy

## Purpose
Define stable, machine-readable identity errors with safe disclosure behavior and HTTP mapping guidance.

## Canonical Error Table

| Code | Human-safe Message | Retryable | Security Disclosure Policy | HTTP Mapping | Audit Required |
|---|---|---|---|---|---|
| IDENTITY_NOT_FOUND | Identity record was not found. | No | Do not reveal whether alternate identities exist. | 404 | Yes |
| INVALID_CREDENTIAL | Credential validation failed. | No | Do not expose which credential element failed. | 401 | Yes |
| EXPIRED_CREDENTIAL | Credential is expired. | Sometimes | No secret details; allow generic renewal guidance. | 401 | Yes |
| DISABLED_IDENTITY | Identity is disabled. | No | Do not expose administrative disable rationale to untrusted clients. | 403 | Yes |
| INVALID_SESSION | Session is invalid. | No | Do not disclose token parsing internals. | 401 | Yes |
| EXPIRED_SESSION | Session has expired. | No | Safe to indicate expiration only. | 401 | Yes |
| REVOKED_SESSION | Session has been revoked. | No | Do not disclose revocation actor to client. | 401 | Yes |
| MISSING_MEMBERSHIP | Workspace membership is missing or inactive. | No | No tenant membership internals to untrusted client. | 403 | Yes |
| PERMISSION_DENIED | Permission requirements were not met. | No | Return high-level reason only. | 403 | Yes |
| POLICY_DENIED | Active policy denied the request. | No | Include policy reference only when caller is authorized for diagnostics. | 403 | Yes |
| PROVIDER_UNAVAILABLE | Identity provider is unavailable. | Yes | Do not leak infrastructure topology details. | 503 | Yes |
| FEDERATION_FAILURE | Federation processing failed. | Sometimes | Do not expose external provider secrets or claims. | 502/503 | Yes |
| CONTRACT_MISMATCH | Identity contract version mismatch detected. | No | Safe to expose expected/received versions only. | 409 | Yes |
| AUDIT_FAILURE | Identity audit persistence failed. | Sometimes | No sensitive event payload disclosure to clients. | 500 | Yes |
| INTERNAL_IDENTITY_FAILURE | Internal identity platform failure occurred. | Sometimes | Generic failure message only. | 500 | Yes |

## Error Stability Rules
- Error code identifiers are stable machine contracts.
- New codes are additive and versioned.
- Existing codes are never repurposed.

## Retryability Policy
- Retryable responses require bounded client retry policy.
- Non-retryable responses require caller correction, re-authentication, or governance review.

## HTTP Guidance
- 401: authentication/session failures.
- 403: authorization and policy denials.
- 404: missing identity resource.
- 409: contract or version conflicts.
- 5xx: provider/internal/audit service failures.

## Audit Requirements
Every emitted identity error must include auditable metadata:
- code
- occurredAt
- request/correlation identifiers
- principal/session reference if available
- execution context scope
