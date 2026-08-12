# Genesis Risk Register

## Program Risks

### PMO-RISK-001
- Category: Release Traceability
- Severity: High
- Description: releaseCommit binding gap in release machine artifacts.
- Mitigation: enforce release metadata validation in release train stage 5 and 6.
- Owner: Release Management

### PMO-RISK-002
- Category: Constitutional Evidence
- Severity: High
- Description: runtime lineage evidence depth incomplete for elevated GAR confidence.
- Mitigation: include lineage evidence expansion in Wave 1-2 package priorities.
- Owner: Certification Authority

### PMO-RISK-003
- Category: Architecture Traceability
- Severity: Medium
- Description: repository-wide RAR/ARD/ADR lineage graph not yet complete.
- Mitigation: architecture traceability package with ARB oversight.
- Owner: Chief Architect

### PMO-RISK-004
- Category: Baseline Control
- Severity: Medium
- Description: current baseline package set requires immutable commit finalization.
- Mitigation: first implementation package dedicated to baseline finalization.
- Owner: Program Director

### PMO-RISK-005
- Category: Integration Determinism
- Severity: Medium
- Description: kernel-runtime-automation coupling can introduce non-deterministic execution under scale.
- Mitigation: mandatory replay and failover validation at architecture and evidence review stages.
- Owner: Quality Assurance

## Risk Escalation Rule
Any High risk without approved mitigation and owner assignment blocks release window entry.
