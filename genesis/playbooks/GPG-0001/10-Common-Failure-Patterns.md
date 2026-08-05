# 10 Common Failure Patterns

## Pattern 1: Ownership expansion

Description:

- Platform implementation drifts into unapproved capability domains.

Prevention:

- Maintain strict in-scope and out-of-scope lists in every work order.

## Pattern 2: Boundary violations

Description:

- Platform takes control of non-owned runtime or policy behavior.

Prevention:

- Require boundary assessments in engineering and certification packages.

## Pattern 3: Scope creep

Description:

- Conditions or defects are used as rationale for unrelated feature work.

Prevention:

- Condition closure work orders must be narrowly scoped and evidence-driven.

## Pattern 4: Hidden dependencies

Description:

- Shared baseline defects are misattributed to platform implementation.

Prevention:

- Use independent validation and ancestry analysis to classify ownership correctly.

## Pattern 5: Mixed-purpose commits

Description:

- A single commit mixes engineering, validation, certification, and release concerns.

Prevention:

- Keep commits atomic and aligned to one stage/work order.

## Pattern 6: Foundation defects misclassified as platform defects

Description:

- Shared infrastructure failures trigger unnecessary platform modifications.

Prevention:

- Route shared issues to foundation maintenance; preserve platform scope.
