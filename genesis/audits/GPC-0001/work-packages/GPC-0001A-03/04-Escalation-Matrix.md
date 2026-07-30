# GPC-0001A-03 Escalation Matrix

Program: GPC-0001  
Work package: GPC-0001A-03  
Date: 2026-07-29

## 1. Escalation Authority

Primary escalation authority:
- ENGINEERING_CONTACTS.md:17
- ENGINEERING_CONTACTS.md:19
- ENGINEERING_CONTACTS.md:21

Release gate authority:
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:32
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:35
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:44

## 2. Escalation Matrix

| Scenario | Initial Owner | Escalate To | Escalation Trigger | Certification Evidence |
|---|---|---|---|---|
| Operations snapshot/stream failure | @genesis-runtime | @genesis-engineering-lead | Persistent stream error events or unavailable snapshot endpoint | src/lib/gop/operations-api.ts:87 |
| Queue pressure and lease instability | @genesis-runtime | @genesis-engineering-lead | Expired lease growth, queue wait p95 degradation, dead-letter growth | src/platform/gop/runtime/queue-manager.ts:554, src/platform/gop/runtime/queue-manager.ts:558 |
| Worker auth/identity failures | @genesis-security + @genesis-runtime | @genesis-engineering-lead | Signed token failures, worker identity mismatch, repeated 403 | src/lib/gop/workers-api.ts:29, src/lib/gop/workers-api.ts:45 |
| GLW callback auth failures | @genesis-security | @genesis-engineering-lead | Callback auth validation failures or callback integrity concerns | src/lib/glw/page-generation-api.ts:69, src/lib/glw/page-generation-api.ts:201 |
| Integration execution failures (n8n) | @genesis-runtime | @genesis-security + @genesis-engineering-lead | Repeated failed integration status or timeout error path | src/lib/glw/n8n.ts:161, src/lib/glw/n8n.ts:181 |
| Database dependency failure | @genesis-runtime | @genesis-engineering-lead | Runtime cannot initialize persistence dependency | src/lib/glw/prisma.ts:13, src/platform/gop/runtime/prisma.ts:13 |
| Security incident | @genesis-security | @genesis-engineering-lead | Any confirmed security incident condition | ENGINEERING_CONTACTS.md:19 |
| Release blocker incident | @genesis-engineering-lead | @genesis-build | Certification or gate condition blocks release | ENGINEERING_CONTACTS.md:21, genesis/constitution/gpm-0001/Genesis-Release-Train.md:44 |

## 3. On-Call Ownership Model

Repository-documented ownership aliases:
1. Runtime operations on-call: @genesis-runtime
2. Security on-call: @genesis-security
3. Build/release on-call: @genesis-build
4. Program escalation authority: @genesis-engineering-lead

Evidence:
- ENGINEERING_CONTACTS.md:10
- ENGINEERING_CONTACTS.md:13
- ENGINEERING_CONTACTS.md:15

Condition:
1. Pager roster tooling and contact schedules are external and must be evidenced in A-03 external monitoring evidence register.
