# Lint Disposition

## Repository Lint Baseline Comparison

- Before (GQI-0001 baseline):
  - errors: 140
  - warnings: 284

- After (current repository-wide scan):
  - errors: 140
  - warnings: 287

Interpretation:
- GQI-0002 did not attempt uncontrolled repository-wide lint remediation.
- Existing debt remains primarily legacy/platform breadth and is outside primary GQI-0002 objective.

## Findings Classification

1. Errors introduced by active GQI-0002 source
- Status: none in targeted quality-gate files.
- Evidence: `npm run lint:quality-gate` passes.

2. Template-only findings
- Managed through new template validator and scoped gate separation.

3. Generated-code findings
- Not remediated in GQI-0002; no new generated-code lint debt introduced by this work.

4. Legacy findings
- Repository-wide lint debt remains in existing modules and tests.
- Deferred as follow-on quality workstream.

5. False positives
- No global false-positive policy changes introduced.

6. Warnings
- Repository warning count increased by 3 due broader repo state fluctuations unrelated to remediation objective.

## Disposition Decision

Primary GQI-0002 goal is reliable TypeScript and template-gate remediation; repository-wide lint zeroing is explicitly deferred with classification retained.
