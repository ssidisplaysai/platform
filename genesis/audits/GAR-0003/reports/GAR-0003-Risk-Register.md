# GAR-0003 Risk Register

## GAR3-RSK-001: Incomplete release commit pointer in release machine records
- Severity: Medium
- Likelihood: Medium
- Impact: Audit trail lookup may require git/tag lookups outside release machine JSON.
- Evidence: GAR3-EVD-006
- Mitigation: Backfill releaseCommit fields in controlled follow-up package.

## GAR3-RSK-002: Insufficient dynamic proof for metadata source-of-truth clause
- Severity: Medium
- Likelihood: Medium
- Impact: Constitutional confidence for clause CNS-2 remains conditional.
- Evidence: GAR3-EVD-003
- Mitigation: Include dynamic lineage probes and runtime assertions in GAR-0004.


