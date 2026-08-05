# 03 Engineering Workflow

## Purpose

Translate approved blueprint scope into deterministic platform implementation without ownership expansion.

## Entry criteria

1. Final design approved.
2. Engineering blueprint package complete.
3. Scope and out-of-scope controls published.
4. Runtime/test boundaries documented.

## Workflow steps

1. Establish implementation branch and baseline commit anchors.
2. Implement only approved platform ownership slices.
3. Keep commits atomic and purpose-specific.
4. Produce engineering package with architecture, boundary, test, and readiness evidence.

## Expected artifacts

1. Engineering code changes (platform-owned only).
2. Engineering package under genesis/engineering/packages/<work-order>/.
3. Validation plan and test report in package.

## Typical evidence

1. File-level scope inspection.
2. Targeted test results.
3. Typecheck and quality reports.
4. Boundary verification notes.

## Exit criteria

1. Implementation complete within approved scope.
2. Engineering package complete.
3. No unresolved platform-owned blocker defects.

## Success criteria

1. Scope preserved.
2. Ownership preserved.
3. Deterministic behavior and observability evidence available.
