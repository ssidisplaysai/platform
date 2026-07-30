# GPC-0001A-02 Backup Strategy

Program: GPC-0001  
Work package: GPC-0001A-02  
Date: 2026-07-29

## 1. Purpose

Define backup strategy for every critical production component established in GPC-0001A-01 without changing architecture or infrastructure design.

Baseline authority:
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/01-Production-Deployment-Topology.md
- genesis/audits/GPC-0001/work-packages/GPC-0001A-01/04-Operational-Dependencies.md

## 2. Critical Component Backup Coverage

| Critical Component (A-01) | Data Classification | Backup Strategy | Owner | Evidence Status |
|---|---|---|---|---|
| Web/API runtime (Next.js) | Stateless executable/service layer | Source-of-truth is repository history and release commit lineage; restore by rebuild/redeploy from approved commit | @genesis-runtime | In-repo evidence available |
| GLW session auth | Secrets + runtime auth policy | Secret value recovery from external secrets authority; auth policy recovery from repository versioned code | @genesis-security | Partial (external secret evidence required) |
| GLW job APIs | Stateless API code + state in PostgreSQL | API layer from repository commit; job state via PostgreSQL backup/restore controls | @genesis-runtime | Partial (DB backup evidence required) |
| GOP operations/metrics APIs | Stateless API code + state in PostgreSQL | API layer from repository commit; runtime state recovery through DB restore and GOP replay semantics | @genesis-runtime | Partial (DB backup evidence required) |
| GOP worker protocol APIs | Stateless API code + runtime state in PostgreSQL | API layer from repository commit; worker/execution state via PostgreSQL restore and worker re-registration | @genesis-runtime | Partial (DB backup evidence required) |
| PostgreSQL persistence | Stateful system of record | Authoritative backup source must be external managed DB backup system; restore tested by controlled drill | @genesis-runtime | External evidence required |
| n8n webhook integration | External integration endpoint + secret | Endpoint/flow config backup in external n8n platform; shared secret recovery from external secrets authority | @genesis-runtime + @genesis-security | External evidence required |
| CI guardrail workflow | Repository workflow config | Workflow config backed by repository history and remote SCM | @genesis-build | In-repo evidence available |
| Release approvals governance | Governance documents/process controls | Governance artifact backup via repository history and release records | @genesis-engineering-lead | In-repo evidence available |

A-01 evidence anchors:
- package.json:8
- src/lib/glw/auth.ts:36
- src/lib/glw/prisma.ts:10
- src/platform/gop/runtime/prisma.ts:10
- src/lib/glw/n8n.ts:181
- .github/workflows/atlas-guardrails.yml:1
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:9

## 3. Backup Scope

Included in backup scope:
1. PostgreSQL data and metadata used by GLW/GOP runtime models.
2. Recovery-relevant repository artifacts for runtime and governance controls.
3. External integration configuration and secret material required to re-establish callbacks and webhook security.
4. Deployment-adjacent edge dependencies identified as open conditions in A-01 (DNS/SSL/reverse proxy/compute descriptors), to the extent they are managed outside this repository.

Excluded from direct in-repo backup control:
1. Physical backup execution platform details (cloud provider, managed DB backup product, DNS platform controls, cert manager controls) not represented in repository artifacts.
2. New infrastructure or migration actions.

## 4. Backup Ownership and Responsibilities

| Responsibility | Owner | Backup Accountability |
|---|---|---|
| Runtime and DB recovery readiness | @genesis-runtime | Ensure DB backup and restore evidence is available and verifiable |
| Secrets backup and recovery controls | @genesis-security | Ensure secret escrow/rotation/recovery evidence and authorization controls |
| CI and release artifact continuity | @genesis-build + @genesis-engineering-lead | Ensure release traceability and workflow artifact continuity |

Owner evidence:
- ENGINEERING_CONTACTS.md:8
- ENGINEERING_CONTACTS.md:10
- ENGINEERING_CONTACTS.md:13
- ENGINEERING_CONTACTS.md:15

## 5. Backup Frequency and Retention

Certification status: Not yet certifiable from repository-only evidence.

Recorded requirement:
1. Frequency and retention must be attested by external backup platform evidence.
2. Values must be component-specific for PostgreSQL, secrets, and external integration configuration.
3. Until attested, backup frequency and retention are marked Deferred in A-02 artifacts.

## 6. Business Continuity Assumptions

1. Repository source history remains available for stateless service and governance artifact restoration.
2. External database backup platform exists and is operational.
3. External secrets platform exists and supports secure recovery workflows.
4. External integration platform (n8n and destination platforms) can be recovered using platform-native controls.

If any assumption is invalid, production certification remains conditional.

## 7. Backup Risks

1. Shared DATABASE_URL persistence boundary creates correlated failure risk across GLW and GOP domains.
2. Missing in-repo evidence for backup retention/frequency prevents unconditional certification.
3. External platform dependency evidence gaps (DNS/SSL/proxy/compute and backup tooling) reduce recovery confidence.
