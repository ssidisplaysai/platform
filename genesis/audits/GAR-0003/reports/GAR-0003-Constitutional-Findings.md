# GAR-0003 Constitutional Findings

## GAR-0003-FND-001: Governance authority chain is implemented and acyclic
- Severity: Informational
- Confidence: Verified
- Clause References: CNS-1, CNS-3, CNS-5
- Evidence: GAR3-EVD-001, GAR3-EVD-004, GAR3-EVD-005
- Supporting Standards: GCCS-0001, GAFS-0001
- Affected Artifacts: genesis/governance/machine/authority-graph.json, genesis/governance/baselines/ggb-0001/machine/baseline-authority.json
- Traceability: GAR3-TRC-001
- Lifecycle State: Recorded
- Recommended Remediation: None required.

## GAR-0003-FND-002: Release machine records do not embed release commit hash
- Severity: Minor
- Confidence: Verified
- Clause References: CNS-3
- Evidence: GAR3-EVD-006, GAR3-EVD-007
- Supporting Standards: GCCS-0001
- Affected Artifacts: genesis/governance/releases/ggr-0001/machine/release-manifest.json, genesis/governance/releases/ggr-0001/machine/release-registry.json
- Traceability: GAR3-TRC-002
- Lifecycle State: Open
- Recommended Remediation: Populate releaseCommit in release-manifest and release-registry in a future controlled update without changing governance rules.

## GAR-0003-FND-003: Business metadata source-of-truth implementation evidence is insufficient in this package run
- Severity: Moderate
- Confidence: High
- Clause References: CNS-2
- Evidence: GAR3-EVD-003, GAR3-EVD-007
- Supporting Standards: GCCS-0001, GAFS-0001
- Affected Artifacts: src/lib/gmp, src/lib/gba, src/lib/gea
- Traceability: GAR3-TRC-003
- Lifecycle State: Open
- Recommended Remediation: Extend GAR-0004 evidence plan with dynamic runtime assertions proving metadata lineage and source-of-truth enforcement.

## GAR-0003-FND-004: Constitutional process lineage (RAR->ARD->ADR) is not fully evidenced for entire repository history in this run
- Severity: Moderate
- Confidence: Medium
- Clause References: CNS-4
- Evidence: GAR3-EVD-001, GAR3-EVD-003
- Supporting Standards: GCCS-0001
- Affected Artifacts: docs/architecture
- Traceability: GAR3-TRC-004
- Lifecycle State: Open
- Recommended Remediation: Add repository-wide architecture lineage extraction and binding in GAR-0004.


