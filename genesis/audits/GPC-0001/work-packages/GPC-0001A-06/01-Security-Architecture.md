# GPC-0001A-06 Security Architecture

Program: GPC-0001  
Work package: GPC-0001A-06  
Date: 2026-07-29

## 1. Purpose

Document and certify the current production security posture for GLW and GOP operational runtime boundaries using repository evidence only.

## 2. Baseline Authority

This package inherits and preserves certified architecture/runtime boundaries from:
1. GPR-0001 architecture certification.
2. GPC-0001A-01 through GPC-0001A-05 certifications.

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01-Authorization.md:1
- genesis/audits/GPC-0001/work-packages/GPC-0001A-04/01-Release-Management-Process.md:1
- genesis/audits/GPC-0001/work-packages/GPC-0001A-05/06-Evidence.json:1

## 3. Environment Isolation and Security Boundaries

Current repository-visible boundaries:
1. Session-gated GLW endpoints require authenticated GLW session.
2. GOP metrics/operations surfaces require both session presence and authorization decision.
3. Worker protocol endpoints require signed bearer worker token bound to worker identity.
4. Workspace boundary enforced by membership checks and default-deny authorization resolver.

Evidence:
- src/lib/glw/page-generation-api.ts:44
- src/lib/glw/page-generation-api.ts:101
- src/lib/gop/events-api.ts:87
- src/lib/gop/operations-api.ts:26
- src/lib/gop/workers-api.ts:20
- src/lib/gop/workers-api.ts:34
- src/lib/gop/workers-api.ts:39
- src/platform/gop/auth/resolver.ts:127
- src/platform/gop/auth/resolver.ts:150

## 4. Authentication Boundaries

Current authentication controls:
1. GLW operator login validates environment-backed admin credentials.
2. GLW session cookie is HMAC-signed and time-bounded.
3. GLW callback path requires bearer secret validation.
4. GOP worker protocol uses signed worker tokens with expiry validation.

Evidence:
- src/lib/glw/auth.ts:36
- src/lib/glw/auth.ts:70
- src/lib/glw/auth.ts:71
- src/lib/glw/auth.ts:76
- src/lib/glw/auth.ts:88
- src/lib/glw/page-generation-api.ts:69
- src/lib/glw/page-generation-api.ts:201
- src/platform/gop/runtime/worker-token.ts:23
- src/platform/gop/runtime/worker-token.ts:44
- src/platform/gop/runtime/worker-token.ts:68

## 5. Authorization Boundaries

Current authorization controls:
1. Identity-to-role mapping is deterministic (admin email -> ADMINISTRATOR, otherwise VIEWER).
2. Workspace membership is required for workspace-scoped actions.
3. Ownership guard restricts viewer access to owned resources.
4. Resolver operates with explicit default-deny when no allow policy matches.

Evidence:
- src/platform/gop/auth/authorization.ts:18
- src/platform/gop/auth/authorization.ts:21
- src/platform/gop/auth/authorization.ts:38
- src/platform/gop/auth/resolver.ts:127
- src/platform/gop/auth/resolver.ts:135
- src/platform/gop/auth/resolver.ts:150
- src/platform/gop/auth/policies.ts:293
- src/platform/gop/auth/policies.ts:413

## 6. Encryption in Transit and At Rest

Repository-verified posture:
1. Callback endpoint references HTTPS deployment URL pattern in setup contract.
2. Sensitive callback and webhook interactions use Authorization bearer secret header.
3. Persistent data storage uses PostgreSQL through DATABASE_URL, but engine-level encryption-at-rest and TLS mode are external platform controls.

Evidence:
- docs/glw-page-generation-setup.md:43
- docs/glw-page-generation-setup.md:48
- src/lib/glw/n8n.ts:96
- src/lib/glw/n8n.ts:190
- src/lib/glw/prisma.ts:13
- src/platform/gop/runtime/prisma.ts:13

## 7. Database Security Assumptions

Assumptions (explicit):
1. DB authentication, transport security, encryption-at-rest, backup encryption, and key management are provided by external managed database controls.
2. Repository enforces only connection-string dependency and does not define DB IAM or KMS policy.

Evidence:
- src/lib/glw/prisma.ts:10
- src/platform/gop/runtime/prisma.ts:10

## 8. Operational Security Assumptions

1. Cloud IAM, firewall, WAF, endpoint protection, and host hardening are external to repository.
2. Certificate lifecycle and TLS termination controls are external to repository.
3. Secrets manager governance and runtime injection controls are external to repository.

These assumptions are tracked as external evidence requirements in the Production Evidence Register.

## 9. Production Security Risks

1. Single admin-email mapping model in repository creates identity-governance dependency on external IdP/account controls.
2. Secrets rotation automation is not represented in repository artifacts.
3. Vulnerability scanning and patch SLAs are not represented in repository artifacts.
4. Security event retention policy and SIEM controls are not represented in repository artifacts.
