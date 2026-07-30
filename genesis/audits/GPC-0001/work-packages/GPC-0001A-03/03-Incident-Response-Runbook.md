# GPC-0001A-03 Incident Response Runbook

Program: GPC-0001  
Work package: GPC-0001A-03  
Date: 2026-07-29

## 1. Purpose

Define the operational response workflow for production incidents affecting GLW and Genesis runtime services, preserving certified architecture and DR boundaries from A-01 and A-02.

## 2. Incident Classification

| Incident Class | Typical Conditions | Severity Mapping | Primary Owner |
|---|---|---|---|
| Availability incident | Operations API unavailable, queue stalled, DB dependency failure | SEV-1 or SEV-2 | @genesis-runtime |
| Security incident | Unauthorized access pattern, worker token abuse, callback auth anomalies | SEV-1 or SEV-2 | @genesis-security |
| Data processing incident | Dead-letter growth, repeated retry exhaustion, callback failures | SEV-2 or SEV-3 | @genesis-runtime |
| Release control incident | Release gate bypass risk or certification gate inconsistency | SEV-1 or SEV-2 | @genesis-engineering-lead + @genesis-build |

Evidence:
- src/lib/gop/operations-api.ts:12
- src/lib/gop/operations-api.ts:87
- src/platform/gop/runtime/queue-manager.ts:553
- src/platform/gop/runtime/queue-manager.ts:554
- src/lib/gop/workers-api.ts:29
- src/lib/glw/page-generation-api.ts:201
- genesis/constitution/gpm-0001/Genesis-Release-Train.md:44

## 3. Incident Workflow

1. Detect
   - Identify trigger from alert matrix signal.
   - Capture evidence snapshot (API response, operations snapshot, metrics payload, queue/dead-letter state).
2. Triage
   - Confirm severity and incident class.
   - Confirm impacted components and current blast radius.
3. Contain
   - Apply least-risk containment actions already defined by runtime controls.
   - Do not perform unapproved architecture changes.
4. Recover
   - Use existing operational controls (retry dead-letter, worker lease recovery, callback retry, approved release rollback path from A-01/A-02 baselines).
5. Verify
   - Confirm health indicators returned to acceptable state.
   - Confirm no unresolved authorization/security violations.
6. Communicate and Close
   - Publish incident status updates to owners/escalation contacts.
   - Close only after verification artifacts are captured.
7. Post-Incident Review
   - Record timeline, root cause, control gaps, and follow-up actions.

## 4. Operational Response Procedures

### 4.1 Operations Snapshot and Stream Failure

1. Validate auth and authorization decision paths.
2. Validate operations snapshot build and stream error emissions.
3. Use direct snapshot endpoint for recovery validation while stream recovers.

Evidence:
- src/lib/gop/operations-api.ts:30
- src/lib/gop/operations-api.ts:52
- src/lib/gop/operations-api.ts:87
- src/lib/gop/operations-api.ts:108

### 4.2 Worker/Queue Degradation

1. Check worker heartbeat freshness and stale-worker eviction behavior.
2. Check queue depth, expired lease count, and queue wait p95.
3. Retry eligible dead letters and document outcome.

Evidence:
- src/platform/gop/runtime/worker-registry.ts:150
- src/platform/gop/runtime/worker-registry.ts:155
- src/platform/gop/runtime/queue-manager.ts:554
- src/platform/gop/runtime/queue-manager.ts:558
- src/platform/gop/runtime/queue-manager.ts:559
- src/lib/gop/fabric-api.ts:56

### 4.3 GLW Job and Integration Degradation

1. Validate dashboard metrics (failed, active, avgDurationMs).
2. Validate callback authorization behavior.
3. Validate n8n response status transitions including failed states.

Evidence:
- src/lib/glw/page-generation-api.ts:325
- src/lib/glw/page-generation-api.ts:329
- src/lib/glw/page-generation-api.ts:201
- src/lib/glw/n8n.ts:161

### 4.4 Database Dependency Failure

1. Confirm runtime DB dependency state from error conditions.
2. Invoke A-02 restore and DR controls when outage requires recovery.
3. Collect external DB platform evidence for full certification traceability.

Evidence:
- src/lib/glw/prisma.ts:13
- src/platform/gop/runtime/prisma.ts:13
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/02-Restore-Runbook.md:1
- genesis/audits/GPC-0001/work-packages/GPC-0001A-02/03-Disaster-Recovery-Plan.md:1

## 5. Incident Communications

Communication channels are owner-alias and governance based in repository evidence:
1. Runtime incidents -> @genesis-runtime and Engineering Leadership.
2. Security incidents -> @genesis-security and Engineering Leadership immediately.
3. Release blockers -> Engineering Leadership and Build Engineering.

Evidence:
- ENGINEERING_CONTACTS.md:10
- ENGINEERING_CONTACTS.md:13
- ENGINEERING_CONTACTS.md:15
- ENGINEERING_CONTACTS.md:19
- ENGINEERING_CONTACTS.md:21

External condition:
1. Chat paging systems, incident management SaaS, and notification transport tooling are not represented in repository artifacts.
2. Those controls must be evidenced in A-03 external evidence register.

## 6. Post-Incident Review Requirements

Minimum PIR artifact content:
1. Incident ID and severity classification.
2. Detection source and timestamp.
3. Component impact map.
4. Timeline of response actions.
5. Root cause statement with contributing factors.
6. Corrective actions with owners and due dates.
7. Evidence links for closure validation.
