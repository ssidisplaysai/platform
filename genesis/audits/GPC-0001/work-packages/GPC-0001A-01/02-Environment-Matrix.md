# GPC-0001A-01 Environment Matrix

Program: GPC-0001  
Work package: GPC-0001A-01  
Date: 2026-07-29

## 1. Environment Scope

Defined environments for production-certification operations:
1. Local
2. Development
3. Test
4. Staging
5. Production

## 2. Common Runtime Contract

All environments use the same application/runtime contract:
1. Next.js runtime process
2. GLW auth/session and API surfaces
3. GOP runtime APIs and worker protocol surfaces
4. PostgreSQL via DATABASE_URL
5. Optional n8n webhook integration for page generation

Evidence:
- package.json:6
- package.json:8
- .env.example:1
- .env.example:4
- .env.example:6
- src/lib/glw/prisma.ts:10
- src/platform/gop/runtime/prisma.ts:10

## 3. Required Environment Variables

| Variable | Purpose | Required In |
|---|---|---|
| GLW_ADMIN_EMAIL | GLW admin credential identifier | All runtime environments |
| GLW_ADMIN_PASSWORD | GLW admin credential secret | All runtime environments |
| GLW_AUTH_SECRET | Session-signing secret | All runtime environments |
| DATABASE_URL | PostgreSQL connection string | All runtime environments |
| GLW_APP_URL | Base URL for callback generation | All runtime environments |
| GLW_N8N_PAGE_WEBHOOK_URL | Outbound n8n endpoint | Environments using page-generation integration |
| GLW_N8N_WEBHOOK_SECRET | Shared webhook secret | Environments using callback/webhook path |

Evidence:
- .env.example:1
- .env.example:2
- .env.example:3
- .env.example:4
- .env.example:5
- .env.example:6
- .env.example:7

## 4. Environment Responsibilities

| Environment | Primary Purpose | Change Authority | Operational Owner | Data Expectations |
|---|---|---|---|---|
| Local | Developer execution and troubleshooting | Engineer | @genesis-runtime | Non-production data only |
| Development | Shared integration and API validation | Team leads | @genesis-runtime | Non-production data only |
| Test | Regression and certification checks | QA/Build | @genesis-testing + @genesis-build | Synthetic/test datasets |
| Staging | Pre-production release confidence | Release authority | @genesis-engineering-lead + @genesis-build | Production-like sanitized data as approved |
| Production | Business operations | Release authority | @genesis-engineering-lead + @genesis-runtime | Production data |

Ownership evidence:
- ENGINEERING_CONTACTS.md:8
- ENGINEERING_CONTACTS.md:10
- ENGINEERING_CONTACTS.md:12
- ENGINEERING_CONTACTS.md:15

## 5. Promotion and Approval Path

Promotion path:
1. Development -> Test -> Staging -> Production

Required governance gates before production release:
1. Planning
2. Implementation
3. Architecture Review
4. Evidence Review
5. GAR Certification
6. Release Approval
7. Production Release

Evidence:
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:4
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:10
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:44

## 6. Environment Conditions

1. DNS/SSL/reverse-proxy ownership details are not codified in repository artifacts.
2. Deployment target substrate configuration (container/orchestrator/IaC descriptors) is not present in repository evidence.
3. These remain explicit conditions to be closed by operational evidence authority in downstream packages.
