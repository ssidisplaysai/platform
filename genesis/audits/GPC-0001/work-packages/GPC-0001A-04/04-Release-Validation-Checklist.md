# GPC-0001A-04 Release Validation Checklist

Program: GPC-0001  
Work package: GPC-0001A-04  
Date: 2026-07-29

## 1. Pre-Deployment Validation

| Check | Acceptance Criteria | Result | Evidence |
|---|---|---|---|
| Release approval gate complete | Release approval stage satisfied before production release | PASS | genesis/constitution/gpm-0001/Genesis-Release-Train.md:32, genesis/constitution/gpm-0001/Genesis-Release-Train.md:44 |
| Certification gate complete | Atlas certification workflow path documented and required | PASS | .github/workflows/atlas-guardrails.yml:26, package.json:20 |
| Release owner assigned | Runtime, build, and leadership owners assigned | PASS | ENGINEERING_CONTACTS.md:10, ENGINEERING_CONTACTS.md:15 |
| Rollback authority available | Decision authorities for runtime, security, release blocker paths identified | PASS | ENGINEERING_CONTACTS.md:13, ENGINEERING_CONTACTS.md:21 |
| Deployment prerequisites validated | Required environment and dependency checks documented | PASS | genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:52 |

## 2. Deployment and Smoke-Test Validation

| Check | Acceptance Criteria | Result | Evidence |
|---|---|---|---|
| Build and start commands valid | Build/start path defined | PASS | package.json:7, package.json:8 |
| Runtime health endpoints validated | Operational verification endpoints documented | PASS | genesis/audits/GPC-0001/work-packages/GPC-0001A-01/03-Deployment-Runbook.md:86 |
| GLW retry behavior validated | Failed-job retry path documented and guarded | PASS | src/app/api/glw/jobs/[id]/retry/route.ts:2, src/lib/glw/page-generation-api.ts:171 |
| Callback retry behavior validated | Callback retry endpoint documented | PASS | src/app/api/glw/jobs/callback/retry/route.ts:2 |
| Queue/dead-letter recovery validated | Dead-letter retry endpoint documented | PASS | src/app/api/gop/dead-letters/[id]/retry/route.ts:2, src/lib/gop/fabric-api.ts:56 |

## 3. Rollback and Recovery Validation

| Check | Acceptance Criteria | Result | Evidence |
|---|---|---|---|
| Rollback decision matrix exists | Deterministic rollback criteria and authorization map documented | PASS | 05-Rollback-Decision-Matrix.md |
| Application rollback procedure exists | Last-known-good rollback procedure documented | PASS | 02-Rollback-Runbook.md |
| Database rollback/forward-recovery strategy exists | A-02 restore/DR strategy referenced and bound to release recovery | PASS | genesis/audits/GPC-0001/work-packages/GPC-0001A-02/02-Restore-Runbook.md:44, genesis/audits/GPC-0001/work-packages/GPC-0001A-02/03-Disaster-Recovery-Plan.md:47 |
| Partial deployment recovery exists | Partial deployment path documented | PASS | 03-Release-Recovery-Plan.md |
| Configuration rollback path exists | Config recovery path documented | PASS | 02-Rollback-Runbook.md |
| Feature-flag rollback applicability documented | Feature-flag control evidence documented or externally deferred | PASS WITH CONDITIONS | src/platform/gop/workspaces/identity.ts:24, 06-Production-Evidence-Register.csv |

## 4. Post-Release Validation and Closure

| Check | Acceptance Criteria | Result | Evidence |
|---|---|---|---|
| Release communications process documented | Start/update/rollback/closure communication requirements documented | PASS | 01-Release-Management-Process.md |
| Release audit trail requirements documented | Required release records defined | PASS | 01-Release-Management-Process.md |
| Postmortem process documented | Lessons-learned and corrective-action process documented | PASS | genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:121 |
| Master production evidence register established | Single cross-package register created and populated | PASS | 06-Production-Evidence-Register.csv |

## 5. Validation Summary

Validation outcome:
1. A-04 release rollback and recovery documentation requirements are complete.
2. External deployment/infra/platform evidence remains conditional and is captured in the master production evidence register.
