# GPC-0001A-02 Recovery Test Requirements

Program: GPC-0001  
Work package: GPC-0001A-02  
Date: 2026-07-29

## 1. Purpose

Define mandatory recovery testing and DR drill requirements needed to move A-02 from documentation completeness to full production certification evidence.

## 2. Required Test Types

1. Database backup restore test
- Validate full restore from backup and point-in-time recovery path (if supported by external platform).

2. Secrets recovery test
- Validate secret recovery, re-binding, and post-rotation runtime functionality.

3. Runtime rebuild/redeploy recovery test
- Validate service restoration from approved release commit.

4. Integration recovery test
- Validate n8n endpoint and callback authorization recovery path.

5. Worker/runtime continuity test
- Validate worker protocol re-registration and queue processing recovery.

6. Full DR scenario drill
- Coordinated multi-component recovery walkthrough using incident role assignments.

## 3. Recovery Testing Cadence Requirement

Current evidence status:
- No certifiable in-repo evidence defines approved production cadence.

Certification requirement:
1. A formal cadence must be approved by owners and recorded in external operational evidence.
2. Until owner-approved cadence evidence is available, cadence is Deferred for certification.

## 4. Drill Evidence Requirements

For each drill execution, evidence must include:
1. Drill identifier and scope.
2. Date and UTC timestamps for start/end.
3. Participating owners and roles.
4. Recovery sequence steps executed.
5. Measured RTO/RPO outcomes per critical component.
6. Deviations and corrective actions.
7. Approval sign-off.

## 5. Verification and Exit Criteria

A-02 testing evidence is certifiable when:
1. Each required test type has at least one executed evidence record.
2. Evidence records include timing and outcome details.
3. Deferred RTO/RPO entries are replaced with approved values and verification dates.
4. Outstanding recovery risks have explicit disposition.

## 6. Open Risks Pending Test Evidence

1. Unknown real-world restore duration for PostgreSQL recovery.
2. Unknown recovery-time impact of external platform dependencies.
3. Unknown queue/worker catch-up behavior under full incident recovery conditions.
