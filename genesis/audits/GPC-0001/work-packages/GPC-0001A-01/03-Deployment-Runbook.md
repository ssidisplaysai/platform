# GPC-0001A-01 Deployment Runbook

Program: GPC-0001  
Work package: GPC-0001A-01  
Date: 2026-07-29

## 1. Objective

Define operational deployment flow for GLW production runtime based on existing repository and governance evidence.

## 2. Preconditions

1. Release has passed governance stages through Release Approval.
2. Required environment variables are present in target environment.
3. DATABASE_URL points to approved PostgreSQL endpoint.
4. If page generation integration is enabled, GLW_N8N_PAGE_WEBHOOK_URL and GLW_N8N_WEBHOOK_SECRET are set.

Evidence:
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:9
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:44
- .env.example:1
- .env.example:7
- src/lib/glw/prisma.ts:13

## 3. CI Validation Flow (Repository-Automated)

Current repository CI flow:
1. Checkout
2. Setup Node 20
3. npm ci
4. npm run atlas:certify

Evidence:
- .github/workflows/atlas-guardrails.yml:8
- .github/workflows/atlas-guardrails.yml:13
- .github/workflows/atlas-guardrails.yml:16
- .github/workflows/atlas-guardrails.yml:19

## 4. Deployment Execution Flow (Operational)

### 4.1 Build and Start Commands

As-is runtime commands:
1. Build: next build
2. Start: next start

Evidence:
- package.json:7
- package.json:8

### 4.2 Startup Sequence

1. Validate required secrets/environment variables are mounted:
- GLW_ADMIN_EMAIL, GLW_ADMIN_PASSWORD, GLW_AUTH_SECRET, DATABASE_URL
2. Validate integration variables when integration is active:
- GLW_APP_URL, GLW_N8N_PAGE_WEBHOOK_URL, GLW_N8N_WEBHOOK_SECRET
3. Start application runtime process.
4. Runtime initializes persistence clients on demand when APIs are invoked.
5. External worker clients (if used) register and heartbeat through GOP worker protocol endpoints.
6. Execute deployment verification checklist.

Evidence:
- .env.example:1
- .env.example:7
- src/lib/glw/prisma.ts:10
- src/platform/gop/runtime/prisma.ts:10
- src/platform/gop/runtime/worker-registry.ts:13
- src/app/api/gop/workers/protocol/register/route.ts:4

### 4.3 Shutdown Sequence

1. Stop acceptance of new release traffic (edge/platform control).
2. Allow in-flight job operations to complete or route them through approved operational handling.
3. Confirm active operational state using API checks.
4. Stop application runtime process.
5. Confirm process termination and database connection release.

Evidence:
- src/lib/glw/job-repository.ts:55
- src/lib/glw/prisma.ts:24
- src/platform/gop/runtime/worker-registry.ts:127

Note:
- Queue drain/lease controls are represented in runtime internals, but repository does not expose an explicit operator drain command in this package scope.

## 5. Health and Verification Endpoints

Available operational verification APIs:
1. GLW dashboard summary
2. GOP metrics
3. GOP operations snapshot
4. GOP operations stream
5. GMP recommendation health (cross-surface health signal)

Evidence:
- src/app/api/glw/dashboard/route.ts:4
- src/app/api/gop/metrics/route.ts:4
- src/app/api/gop/operations/route.ts:4
- src/app/api/gop/operations/stream/route.ts:3
- src/app/api/gmp/recommendations/health/route.ts:4

## 6. Rollback Entry Points (Identification Only)

This package identifies rollback/recovery entry points; detailed rollback procedure remains in GPC-0001A-04.

Identified entry points:
1. GLW failed job retry endpoint
2. GLW callback retry endpoint
3. GOP dead-letter retry endpoint
4. GMP publication rollback endpoint

Evidence:
- src/app/api/glw/jobs/[id]/retry/route.ts:9
- src/app/api/glw/jobs/callback/retry/route.ts:4
- src/app/api/gop/dead-letters/[id]/retry/route.ts:8
- src/app/api/gmp/publishing/publications/[publicationId]/rollback/route.ts:8

## 7. Out-of-Repository Operational Controls

The following deployment controls are required in production but are not codified in repository artifacts:
1. DNS records
2. SSL certificate provisioning and renewal
3. Reverse proxy/edge routing
4. Host/compute substrate rollout mechanics

Condition handling:
- These controls must be referenced from platform operations authority records when certifying this runbook for production execution.
