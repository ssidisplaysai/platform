# GPC-0001A-03 Alert Matrix

Program: GPC-0001  
Work package: GPC-0001A-03  
Date: 2026-07-29

## 1. Alert Severity Model

| Severity | Classification | Operational Meaning | Required Response |
|---|---|---|---|
| SEV-1 | Critical outage/security | Production service unavailable, major data/control risk, or active security incident | Immediate incident activation and escalation |
| SEV-2 | Major degradation | Significant production degradation with customer/operations impact | Incident activation and prioritized restoration |
| SEV-3 | Moderate degradation | Partial capability degradation with workaround | Managed response within active operations cycle |
| SEV-4 | Informational | Non-critical anomaly or trend warning | Track, triage, and include in routine operations review |

## 2. Alert Catalog

| Alert ID | Domain | Trigger Signal | Severity | Owner | Primary Route | Secondary Route | Evidence |
|---|---|---|---|---|---|---|---|
| A03-ALT-001 | Operations API | Unauthorized access to operations snapshot endpoint (401) | SEV-3 | @genesis-security | Security + Runtime | Engineering Leadership | src/lib/gop/operations-api.ts:12 |
| A03-ALT-002 | Operations API | Forbidden operations-read authorization (403) | SEV-3 | @genesis-security | Security + Runtime | Engineering Leadership | src/lib/gop/operations-api.ts:16 |
| A03-ALT-003 | Operations stream | Stream poll error event emitted | SEV-2 | @genesis-runtime | Runtime Platform | Build Engineering | src/lib/gop/operations-api.ts:87 |
| A03-ALT-004 | GOP metrics | Metrics endpoint denied (401/403) | SEV-3 | @genesis-security | Security + Runtime | Engineering Leadership | src/lib/gop/events-api.ts:18, src/lib/gop/events-api.ts:22 |
| A03-ALT-005 | Worker auth | Signed worker token missing/invalid | SEV-2 | @genesis-security | Security + Runtime | Engineering Leadership | src/lib/gop/workers-api.ts:29 |
| A03-ALT-006 | Worker protocol | Worker identity mismatch/authorization failure | SEV-2 | @genesis-security | Security + Runtime | Engineering Leadership | src/lib/gop/workers-api.ts:45, src/lib/gop/workers-api.ts:151 |
| A03-ALT-007 | Lease lifecycle | Lease renew/release failure not found (404) | SEV-2 | @genesis-runtime | Runtime Platform | Engineering Leadership | src/lib/gop/workers-api.ts:246, src/lib/gop/workers-api.ts:277 |
| A03-ALT-008 | Queue health | Expired lease growth and queue wait p95 degradation | SEV-2 | @genesis-runtime | Runtime Platform | Build Engineering | src/platform/gop/runtime/queue-manager.ts:554, src/platform/gop/runtime/queue-manager.ts:558 |
| A03-ALT-009 | Dead-letter pressure | Dead-letter depth increase and retry exhaustion | SEV-2 | @genesis-runtime | Runtime Platform | Engineering Leadership | src/platform/gop/runtime/queue-manager.ts:553, src/platform/gop/runtime/queue-manager.ts:475 |
| A03-ALT-010 | GLW callback auth | Callback authorization check fails | SEV-2 | @genesis-security | Security + Runtime | Engineering Leadership | src/lib/glw/page-generation-api.ts:69, src/lib/glw/page-generation-api.ts:201 |
| A03-ALT-011 | GLW integration | n8n failed status response | SEV-2 | @genesis-runtime | Runtime Platform | Security and Build | src/lib/glw/n8n.ts:161 |
| A03-ALT-012 | Persistence dependency | DATABASE_URL missing at runtime startup | SEV-1 | @genesis-runtime | Runtime Platform | Engineering Leadership | src/lib/glw/prisma.ts:13, src/platform/gop/runtime/prisma.ts:13 |
| A03-ALT-013 | Release gate | Release approval/production release gate not satisfied | SEV-1 | @genesis-engineering-lead | Engineering Leadership | Build Engineering | genesis/constitution/gpm-0001/Genesis-Release-Train.md:44 |
| A03-ALT-014 | Guardrail pipeline | Guardrail build/test gate failure | SEV-2 | @genesis-build | Build Engineering | Engineering Leadership | .github/workflows/atlas-guardrails.yml:1 |

## 3. Alert Ownership and Routing Rules

Routing authority sources:
1. Runtime owners: ENGINEERING_CONTACTS.md:10
2. Security owners: ENGINEERING_CONTACTS.md:13
3. Build owners: ENGINEERING_CONTACTS.md:15
4. Escalation triggers (security incidents/release blockers): ENGINEERING_CONTACTS.md:19, ENGINEERING_CONTACTS.md:21

Routing implementation note:
1. Pager/chat/notification tooling is not represented in repository artifacts.
2. Tool-specific routes must be evidenced externally in A-03 external evidence register.

## 4. Coverage Validation

This matrix guarantees:
1. Every defined alert has a severity.
2. Every defined alert has an owner.
3. Every critical runtime component established in A-01 has at least one mapped alert.
