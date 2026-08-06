# 08 Validation Engine Condition Revalidation

Condition ID:

- C006

Original condition intent:

- Strengthen shared validation hardening evidence for deterministic rule behavior and explicit negative-path validator checks.

Source evidence reviewed:

1. src/platform/shared/validation/InvariantEngine.ts
- Rule evaluation uses deterministic ordering by ruleId.
- assert() emits explicit aggregate invariant violation errors.

2. src/platform/shared/validation/CommonValidators.ts
- assertRequiredString, assertArray, assertObject all fail explicitly with field-specific errors on invalid inputs.

Test evidence reviewed:

- tests/shared/gsp-1001-shared-framework.test.ts

Directly passing validation-focused tests:

1. invariant engine aggregates deterministic validation failures.
2. invariant engine preserves deterministic ordering with duplicate rule ids.
3. common validators fail explicitly on negative paths.

Revalidation result:

- C006 VERIFIED CLOSED.