# GPC-0001A-06 Security Operations

Program: GPC-0001  
Work package: GPC-0001A-06  
Date: 2026-07-29

## 1. Purpose

Document current operational security process coverage for auditability, incident escalation, vulnerability/dependency management, and patch governance.

## 2. Audit Logging and Traceability (Repository-Visible)

Repository-visible event model supports security-relevant traceability fields:
1. actorId and actorName,
2. occurredAt timeline field,
3. idempotency key and sequencing controls,
4. replayable job event history and timeline summarization.

Evidence:
- src/platform/gop/event-store.ts:15
- src/platform/gop/event-store.ts:19
- src/platform/gop/event-store.ts:20
- src/platform/gop/event-store.ts:23
- src/platform/gop/event-store.ts:35
- src/platform/gop/persistence/prisma-event-store.ts:85
- src/platform/gop/persistence/prisma-event-store.ts:89
- src/platform/gop/persistence/prisma-event-store.ts:93

Condition:
1. Centralized SIEM forwarding, immutable retention policy, and legal-hold requirements are external to repository.

## 3. Security Event Retention

Current posture:
1. Event persistence for GOP job history is implemented.
2. Retention duration policy, archival tiering, and purge controls are not codified in repository artifacts.

Evidence:
- src/platform/gop/persistence/prisma-event-store.ts:282
- src/platform/gop/persistence/prisma-event-store.ts:378

Certification condition:
1. Retention and archival controls require external evidence records.

## 4. Security Incident Escalation

Current escalation model:
1. Security incident class and severity mapping documented in A-03.
2. Security incidents escalate to Security and Engineering Leadership.

Evidence:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:16
- genesis/audits/GPC-0001/work-packages/GPC-0001A-03/03-Incident-Response-Runbook.md:107
- ENGINEERING_CONTACTS.md:19

## 5. Vulnerability Management and Dependency Management

Repository-visible controls:
1. CI performs deterministic dependency install via npm ci.
2. CI runs atlas certification chain (`atlas:certify`) as gate.
3. Release policy requires evidence review and release approval before production.

Evidence:
- .github/workflows/atlas-guardrails.yml:23
- .github/workflows/atlas-guardrails.yml:26
- package.json:20
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:26
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:32

Condition:
1. Formal vulnerability scanning platform, CVE triage workflow, SLA tracking, and patch governance records are external to repository.

## 6. Security Patch Management

Current repository position:
1. Dependency versions and update actions are source-controlled.
2. No explicit in-repository patch SLA policy artifact is present.

Evidence:
- package.json:24
- package.json:36

Condition:
1. Security patch policy and emergency patch workflow must be evidenced externally.

## 7. Operational Security Assumptions and Risks

Assumptions:
1. External IAM and network controls enforce production perimeter and administrative access constraints.
2. External KMS/certificate controls enforce cryptographic governance.

Risks:
1. Repository does not by itself prove external control implementation or effectiveness.
2. Certification remains conditional until external evidence items are verified.
