# GPC-0001A-01 Production Deployment Topology

Program: GPC-0001  
Work package: GPC-0001A-01  
Date: 2026-07-29

## 1. Purpose

Document the as-is production deployment topology for GLW and required Genesis runtime services, without changing architecture or application behavior.

## 2. Topology Summary (As-Is)

Deployment model represented in repository evidence:
1. Single Next.js runtime hosts GLW and Genesis API surfaces.
2. Runtime uses PostgreSQL through Prisma adapters for both GLW and GOP persistence.
3. GLW page generation uses outbound webhook integration to n8n.
4. Worker orchestration surfaces exist via GOP worker protocol APIs.
5. CI pipeline enforces guardrails and tests, but deployment execution remains outside repository automation.

## 3. Deployed Components and Owners

| Component | Role | Owner | Evidence |
|---|---|---|---|
| Web/API runtime (Next.js) | Hosts UI and API routes | @genesis-runtime | package.json:6, package.json:8, package.json:28 |
| GLW session auth | Credential auth and signed session cookie | @genesis-security | src/lib/glw/auth.ts:6, src/lib/glw/auth.ts:36, src/lib/glw/auth.ts:70 |
| GLW job APIs | Job creation, status, callback intake, retries | @genesis-runtime | src/app/api/glw/jobs/page/route.ts:4, src/app/api/glw/jobs/callback/route.ts:4, src/app/api/glw/jobs/[id]/retry/route.ts:9 |
| GOP operations/metrics APIs | Runtime operations and metrics visibility | @genesis-runtime | src/app/api/gop/operations/route.ts:4, src/app/api/gop/metrics/route.ts:4 |
| GOP worker protocol APIs | Worker register/heartbeat/lease protocol | @genesis-runtime | src/app/api/gop/workers/protocol/register/route.ts:4, src/app/api/gop/workers/protocol/[id]/leases/acquire/route.ts:8 |
| PostgreSQL persistence | Shared persistence boundary for GLW and GOP | @genesis-runtime | src/lib/glw/prisma.ts:10, src/platform/gop/runtime/prisma.ts:10 |
| n8n webhook integration | Page generation external execution | @genesis-runtime | src/lib/glw/n8n.ts:181, src/lib/glw/n8n.ts:96 |
| CI guardrail workflow | Build/test certification checks | @genesis-build | .github/workflows/atlas-guardrails.yml:1, .github/workflows/atlas-guardrails.yml:18 |
| Release approvals governance | Approval gate before production release | @genesis-engineering-lead | genesis/constitution/gpm-0001/Genesis-Release-Train.md:9, genesis/constitution/gpm-0001/Genesis-Release-Train.md:44 |

## 4. Runtime and Data Boundaries

Primary persistence models used by deployment:
1. GLW jobs: prisma/schema.prisma:26
2. GOP event/execution/worker/lease/dead-letter: prisma/schema.prisma:48, prisma/schema.prisma:78, prisma/schema.prisma:151, prisma/schema.prisma:181, prisma/schema.prisma:209
3. Environment config domain model: prisma/schema.prisma:375

Boundary interpretation:
1. Application and platform runtime persistence share DATABASE_URL-backed PostgreSQL.
2. Runtime components are logically separated in code but co-deployed in one application process model.

## 5. Integration and Trust Boundaries

Inbound trust boundaries:
1. GLW session-protected endpoints require valid GLW session.
2. Callback endpoints require Bearer secret validation.
3. Worker protocol endpoints accept worker registrations and lease lifecycle operations.

Outbound trust boundaries:
1. n8n webhook calls use Bearer secret authorization.

Evidence:
- src/lib/glw/page-generation-api.ts:43
- src/lib/glw/page-generation-api.ts:69
- src/lib/glw/n8n.ts:96
- src/lib/glw/n8n.ts:190

## 6. Infrastructure Adjacencies

Documented in repository:
1. CI validation workflow only.

Not explicitly represented in repository configuration:
1. DNS records
2. SSL certificate management
3. Reverse proxy implementation
4. Cloud service topology descriptors (Docker, Terraform, Helm, etc.)

Evidence:
- INFRA_DESCRIPTOR_FILES=NONE (scan output, 2026-07-29)

## 7. Topology Constraints for Production Certification

1. This package documents current runtime topology only.
2. No infrastructure migration, architecture redesign, or behavior changes are included.
3. Missing external infrastructure descriptors remain open certification conditions until captured in evidence by later packages or operational authority records.
