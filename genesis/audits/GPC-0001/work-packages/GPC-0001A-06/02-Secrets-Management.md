# GPC-0001A-06 Secrets Management

Program: GPC-0001  
Work package: GPC-0001A-06  
Date: 2026-07-29

## 1. Purpose

Document current secret inventory, ownership, lifecycle, and rotation posture for production certification.

## 2. Secret Inventory (Repository-Visible)

| Secret/Variable | Purpose | Used By | Source Type | Status |
|---|---|---|---|---|
| GLW_ADMIN_EMAIL | GLW administrative login identity | GLW auth + role inference | environment variable | Verified |
| GLW_ADMIN_PASSWORD | GLW administrative login credential | GLW auth validation | environment variable | Verified |
| GLW_AUTH_SECRET | Session HMAC signing key | GLW session token signing/validation | environment variable | Verified |
| GLW_N8N_WEBHOOK_SECRET | Outbound webhook bearer + inbound callback bearer validation | GLW n8n adapter + callback auth | environment variable | Verified |
| GOP_WORKER_TOKEN_SECRET | Worker protocol signed-token verification key | GOP worker protocol auth | environment variable | Verified |
| DATABASE_URL | DB connectivity credential and boundary | GLW/GOP Prisma clients | environment variable | Verified |

Evidence:
- docs/glw-page-generation-setup.md:27
- docs/glw-page-generation-setup.md:31
- docs/glw-page-generation-setup.md:35
- src/lib/glw/auth.ts:36
- src/lib/glw/auth.ts:70
- src/lib/glw/auth.ts:71
- src/lib/glw/n8n.ts:96
- src/lib/glw/page-generation-api.ts:39
- src/lib/gop/workers-api.ts:34
- src/lib/glw/prisma.ts:10
- src/platform/gop/runtime/prisma.ts:10

## 3. Secret Ownership

Current repository-level ownership map:
1. Runtime Platform owns operational runtime secrets and worker protocol secrets.
2. Security and Engineering Leadership own approval/escalation governance.
3. Build Engineering owns CI gate execution for certification readiness.

Evidence:
- ENGINEERING_CONTACTS.md:4
- ENGINEERING_CONTACTS.md:7
- ENGINEERING_CONTACTS.md:9
- ENGINEERING_CONTACTS.md:19

Condition:
1. Canonical enterprise secret owners, custody chains, and access logs are external and must be evidenced outside repository.

## 4. Secret Rotation Policy and Lifecycle

Repository-verified lifecycle elements:
1. Session token has explicit TTL and expiration enforcement.
2. Worker protocol token has explicit TTL and expiration enforcement.
3. Callback and webhook secret validation rejects absent/invalid bearer values.

Evidence:
- src/lib/glw/auth.ts:7
- src/lib/glw/auth.ts:76
- src/platform/gop/runtime/worker-token.ts:36
- src/platform/gop/runtime/worker-token.ts:68
- src/lib/glw/page-generation-api.ts:69
- src/lib/glw/page-generation-api.ts:201

External-condition items:
1. Secret generation standard.
2. Rotation cadence and forced-rotation triggers.
3. Revocation process and compromised-secret emergency rotation.
4. Vault/KMS implementation controls.

These are tracked as external evidence in the Production Evidence Register.

## 5. Credential Lifecycle

Observed repository controls:
1. Login validates static environment-backed admin credential pair.
2. Session creation and deletion are explicit actions.
3. Callback and worker protocol credentials are bearer-token based and validated per request.

Evidence:
- src/app/glw/login/actions.ts:18
- src/app/glw/login/actions.ts:22
- src/app/glw/actions.ts:7
- src/lib/glw/auth.ts:95
- src/lib/gop/workers-api.ts:39

## 6. API Credentials and Service Accounts

Current model:
1. n8n integration credential: GLW_N8N_WEBHOOK_SECRET (shared outbound/inbound).
2. GOP worker protocol credential: signed worker bearer token with tokenId and expiry.

Evidence:
- src/lib/glw/n8n.ts:96
- src/lib/glw/n8n.ts:190
- src/lib/gop/workers-api.ts:168
- src/platform/gop/runtime/worker-token.ts:23

Condition:
1. External cloud service-account IAM and managed API credential lifecycle are not represented in repository.
