# GPC-0001A-04 Rollback Runbook

Program: GPC-0001  
Work package: GPC-0001A-04  
Date: 2026-07-29

## 1. Purpose

Define authorized production rollback and forward-recovery procedures for release failures while preserving architecture and certified operational baselines.

## 2. Rollback Triggers

1. Release smoke-test failure with customer-impacting behavior.
2. Sustained SEV-1 or SEV-2 degradation after deployment.
3. Security-impacting deployment anomaly.
4. Data-integrity concern requiring controlled recovery procedure.

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:15
- genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:16
- genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:107

## 3. Rollback Authorization

| Decision Type | Required Authority | Secondary Authority |
|---|---|---|
| Standard application rollback | @genesis-runtime | @genesis-engineering-lead |
| Security-related rollback | @genesis-security | @genesis-engineering-lead |
| Data recovery or forward-recovery invocation | @genesis-runtime | @genesis-engineering-lead |
| Release gate exception or abort | @genesis-engineering-lead | @genesis-build |

Evidence:
- ENGINEERING_CONTACTS.md:10
- ENGINEERING_CONTACTS.md:13
- ENGINEERING_CONTACTS.md:15
- ENGINEERING_CONTACTS.md:21

## 4. Rollback Decision Matrix Reference

Use deterministic decision mapping in:
1. genesis/audits/GPC-0001/work-packages/GPC-0001A-04/05-Rollback-Decision-Matrix.md

## 5. Application Rollback Procedure

1. Declare rollback condition and freeze further release actions.
2. Identify last known good approved release commit.
3. Redeploy using the certified A-01 deployment command path.
4. Execute deployment verification and smoke tests.
5. Confirm monitoring/alert conditions return to acceptable state.

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:44
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:45
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:86
- package.json:7
- package.json:8

## 6. Database Rollback or Forward-Recovery Strategy

Strategy rule:
1. Do not perform ad-hoc destructive schema rollback.
2. Use A-02 certified restore and DR procedures for data recovery.
3. Prefer forward recovery with validated restore point and controlled replay when possible.

Procedure:
1. Classify data-impact scope.
2. Select approved backup/restore point from external DB evidence source.
3. Execute A-02 restore sequence.
4. Revalidate service and data-access paths.

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/02-Restore-Runbook.md:44
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/02-Restore-Runbook.md:112
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/03-Disaster-Recovery-Plan.md:47
- src/lib/glw/prisma.ts:13
- src/platform/gop/runtime/prisma.ts:13

## 7. Failed and Partial Deployment Recovery

### 7.1 Failed deployment (no viable service state)

1. Roll back application to last known good release.
2. Re-run smoke tests.
3. If persistence inconsistency is detected, invoke forward-recovery procedure.

### 7.2 Partial deployment (mixed service state)

1. Halt progression and prevent additional rollouts.
2. Restore uniform version state by completing rollback or controlled redeploy.
3. Verify queue, retry, and dead-letter stability before closing.

Evidence:
- src/lib/glw/page-generation-api.ts:171
- src/lib/glw/page-generation-api.ts:182
- src/lib/gop/fabric-api.ts:56
- src/lib/gop/fabric-api.ts:67
- genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:59

## 8. Configuration Rollback

1. Recover previous approved environment configuration set.
2. Re-validate required runtime variables and secret bindings.
3. Re-run smoke tests and monitoring verification.

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:52
- .env.example:1
- .env.example:7

## 9. Feature-Flag Rollback (If Applicable)

Repository evidence indicates workspace capability feature flags exist in GOP workspace metadata.

Current certification interpretation:
1. In-repository feature flags are static workspace capability descriptors.
2. External dynamic feature-flag management platform evidence is not represented in repository artifacts.
3. If dynamic feature flags are used in production, rollback controls must be evidenced externally and recorded in the master production evidence register.

Evidence:
- src/platform/gop/workspaces/identity.ts:24
- src/platform/gop/workspaces/identity.ts:53
- src/lib/gop/platform-bootstrap-api.ts:18
- src/lib/gop/platform-bootstrap-api.ts:55

## 10. Rollback Verification

Minimum post-rollback checks:
1. GLW dashboard endpoint operational.
2. GLW job retry and callback retry paths operational.
3. GOP dead-letter retry path operational.
4. Operations and metrics surfaces indicate stable state.
5. Release communications and audit-trail entries recorded.

Evidence:
- src/app/api/glw/jobs/[id]/retry/route.ts:2
- src/app/api/glw/jobs/callback/retry/route.ts:2
- src/app/api/gop/dead-letters/[id]/retry/route.ts:2
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:86
