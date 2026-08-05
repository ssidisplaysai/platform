# 04 Validation Workflow

## Purpose

Provide independent verification of engineering baseline before certification, including classification of inherited exceptions versus platform regressions.

## Entry criteria

1. Engineering work order complete.
2. Engineering package published.
3. Validation scope and non-modification rules declared.

## Workflow steps

1. Re-verify baseline lineage and commit ancestry.
2. Execute required validation suite.
3. Classify failures by ownership (platform-owned vs shared baseline).
4. Produce independent validation decision and condition recommendations.

## Expected artifacts

1. Validation package under genesis/engineering/validation/<work-order>/.
2. Baseline verification report.
3. Failure classification report.
4. Validation decision report.

## Typical evidence

1. Command logs for typecheck, quality, and targeted test suites.
2. File ancestry and blob identity comparisons for inherited exceptions.
3. Import and coupling analysis proving independence.

## Exit criteria

1. Validation decision issued.
2. Blockers and conditions explicitly enumerated.
3. Evidence chain complete and independently reproducible.

## Success criteria

1. No ambiguity about defect ownership.
2. Certification can proceed with clear condition set.
