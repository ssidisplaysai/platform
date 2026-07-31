# Quality Metrics

## Metric Model

Define repository-level quality metrics captured on every quality gate run.

## Baseline Metrics (2026-07-30)

1. TypeScript
- type_error_count: 333
- type_error_scope: tools/genesis/templates/entity only
- typecheck_duration_seconds: 9.43

2. Lint
- lint_error_count: 140
- lint_warning_count: 284
- lint_files_with_findings: 142
- lint_duration_seconds: 39.47

3. Tests (focused authorization certification sample)
- test_suites_passed: 10
- tests_passed: 28
- tests_failed: 0
- focused_test_duration_seconds: 7.18

4. Dependency security
- vulnerability_total: 34
- vulnerability_high: 33
- vulnerability_moderate: 1
- vulnerability_critical: 0

5. Template quality
- placeholder_template_files: 8
- placeholder_template_tokens: 161
- placeholder_template_lines: 600

6. CI maturity
- workflow_count: 1
- quality_gate_workflow_partition_count: 0

7. Repository health indicators
- backup_like_file_count: 1
- root_test_output_artifact_count: 6

## Trend Metrics (Required)

Track over time:
- type_error_count trend
- lint_error_count trend
- vulnerability_high trend
- quality gate duration trend
- regression suite duration trend
- certification readiness score trend

## Certification Readiness Score (Proposed)

Weighted model:
- Typecheck gate: 20%
- Lint gate: 20%
- Test gate: 20%
- Security gate: 15%
- Architecture/governance gate: 15%
- Repository health gate: 10%

Readiness bands:
- 95-100: release-certifiable
- 85-94: certifiable with non-blocking conditions
- <85: not certifiable

## Reporting Standard

Every gate run must emit machine-readable summary:
- quality-metrics.json
- quality-metrics-history appendable record
