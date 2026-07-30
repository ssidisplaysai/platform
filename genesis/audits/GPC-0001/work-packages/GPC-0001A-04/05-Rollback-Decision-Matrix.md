# GPC-0001A-04 Rollback Decision Matrix

Program: GPC-0001  
Work package: GPC-0001A-04  
Date: 2026-07-29

## 1. Decision Matrix

| Condition | Severity | Primary Decision | Fallback Decision | Authorization | Validation Required |
|---|---|---|---|---|---|
| Smoke test fails after deployment | SEV-2 | Immediate application rollback to last known good release | Controlled redeploy once root cause is resolved | @genesis-runtime | Endpoint smoke checks and operations metrics review |
| Sustained service outage post-release | SEV-1 | Immediate rollback and incident declaration | A-02 DR invocation if rollback fails | @genesis-runtime + @genesis-engineering-lead | Runtime + DB + queue verification |
| Security anomaly linked to release | SEV-1 | Security-led rollback and containment | Full incident escalation and access lockdown | @genesis-security + @genesis-engineering-lead | Security validation and operational integrity checks |
| Data-integrity regression | SEV-1 | Forward recovery via A-02 restore strategy | Extended DR recovery sequence | @genesis-runtime + @genesis-engineering-lead | Data validation and service acceptance checks |
| Partial deployment across runtime instances | SEV-2 | Normalize to last known good version state | Controlled rolling redeploy | @genesis-runtime | Version consistency and health checks |
| Callback/integration failure spike | SEV-2 | Retry and rollback decision based on service impact | Incident runbook execution | @genesis-runtime | Callback auth and job success-rate verification |
| Release gate or approval gap detected | SEV-1 | Stop release and revert in-flight deployment actions | Escalate as release blocker | @genesis-engineering-lead + @genesis-build | Gate completeness and audit trail validation |

## 2. Rollback Authorization Policy

Authorization rules:
1. No rollback executes without a named owner and recorded decision reason.
2. Security-driven rollback requires Security and Engineering Leadership visibility.
3. Data-impacting rollback/recovery decisions must reference A-02 restore/DR controls.
4. Release blockers escalate through leadership and build channels.

Evidence:
- ENGINEERING_CONTACTS.md:19
- ENGINEERING_CONTACTS.md:21
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/02-Restore-Runbook.md:31
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/03-Disaster-Recovery-Plan.md:23

## 3. Database Rollback vs Forward-Recovery Decision Rule

Decision logic:
1. If application release can be rolled back without data-impact risk, perform application rollback first.
2. If data-impact is present, trigger forward-recovery path from A-02 restore runbook.
3. If forward recovery cannot satisfy integrity criteria, escalate to DR sequence with explicit risk declaration.

## 4. Configuration and Feature-Flag Decision Rule

1. Configuration rollback uses last approved environment and secret set.
2. In-repository workspace feature flags are static descriptors and not an operational toggle system.
3. If external feature-flag systems are used in production, evidence and rollback controls are required in master production evidence register.
