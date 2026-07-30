# GPC-0001A-02 Restore Runbook

Program: GPC-0001  
Work package: GPC-0001A-02  
Date: 2026-07-29

## 1. Objective

Define the operational restore process for critical components in the A-01 topology.

Constraint:
- This runbook documents restore process and verification only; it does not implement runtime or infrastructure changes.

## 2. Restore Triggers

1. Data corruption or deletion in PostgreSQL-backed runtime state.
2. Loss of secrets required for GLW auth or n8n callback verification.
3. Loss of external integration configuration (n8n endpoint configuration).
4. Service recovery after production incident where runtime must be rebuilt from certified release commit.

## 3. Restore Prerequisites

1. Incident declared and scope classified.
2. Recovery owner assigned.
3. Most recent certifiable backup point identified from external evidence source.
4. Approved release commit identified for stateless component rehydration.
5. Change and communications channels opened.

## 4. Component Restore Procedures

### 4.1 Stateless Runtime and API Surfaces

Components:
- Web/API runtime
- GLW job APIs
- GOP operations/metrics APIs
- GOP worker protocol APIs
- CI workflow and release-governance docs

Procedure:
1. Identify approved release commit.
2. Rebuild and restart runtime using standard commands and approved deployment flow from A-01.
3. Validate API surface availability and auth/session behavior.
4. Validate GOP operations/metrics endpoints.

Evidence anchors:
- package.json:7
- package.json:8
- src/app/api/glw/dashboard/route.ts:4
- src/app/api/gop/metrics/route.ts:4
- src/app/api/gop/operations/route.ts:4

### 4.2 PostgreSQL Stateful Recovery

Components:
- GLW and GOP persisted models under shared DATABASE_URL boundary

Procedure:
1. Identify backup snapshot/point-in-time candidate from external DB platform.
2. Execute restore in controlled recovery environment.
3. Validate schema and critical model availability.
4. Repoint runtime to restored DB endpoint when approved.
5. Execute post-restore application verification checks.

Evidence anchors:
- src/lib/glw/prisma.ts:10
- src/platform/gop/runtime/prisma.ts:10
- prisma/schema.prisma:26
- prisma/schema.prisma:48
- prisma/schema.prisma:78
- prisma/schema.prisma:151
- prisma/schema.prisma:181
- prisma/schema.prisma:209

### 4.3 Secrets Recovery

Components:
- GLW_AUTH_SECRET
- GLW_ADMIN_PASSWORD
- GLW_N8N_WEBHOOK_SECRET

Procedure:
1. Recover secrets from external secrets authority using approved break-glass protocol.
2. Rotate compromised secrets where incident requires rotation.
3. Validate callback authorization and session issuance.
4. Verify no secret value leakage in logs and incident records.

Evidence anchors:
- .env.example:2
- .env.example:3
- .env.example:7
- src/lib/glw/auth.ts:36
- src/lib/glw/page-generation-api.ts:69
- src/lib/glw/n8n.ts:96

### 4.4 External Integration Recovery (n8n)

Components:
- GLW_N8N_PAGE_WEBHOOK_URL endpoint configuration

Procedure:
1. Recover n8n flow and endpoint configuration from n8n platform backup/export evidence.
2. Re-apply webhook secret binding.
3. Execute callback and job round-trip validation.

Evidence anchors:
- .env.example:6
- src/lib/glw/n8n.ts:181
- src/app/api/glw/jobs/callback/route.ts:4
- src/app/api/glw/jobs/callback/retry/route.ts:4

## 5. Restore Verification

Required verification sequence:
1. Auth verification (session creation/login path).
2. DB connectivity verification.
3. GLW dashboard/jobs endpoint verification.
4. GOP operations/metrics endpoint verification.
5. Callback authorization verification.
6. Retry and recovery endpoint verification.

Verification endpoints:
- src/app/api/glw/dashboard/route.ts:4
- src/app/api/glw/jobs/route.ts:4
- src/app/api/glw/jobs/[id]/route.ts:9
- src/app/api/gop/operations/route.ts:4
- src/app/api/gop/metrics/route.ts:4
- src/app/api/gop/dead-letters/[id]/retry/route.ts:8

## 6. Restore Validation Status

Current certification status:
- Process definition: Complete
- External execution evidence (DB restore run logs, secrets recovery logs, integration restore logs): Pending external evidence

Certification impact:
- Restore process is documented but cannot be fully certified without external restore execution evidence.
