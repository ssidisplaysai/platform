# Template Validation

## Validator

Path:
- `tools/genesis/templates/entity/validate-templates.mjs`

## Deterministic Checks Implemented

1. Discover supported templates from catalog and enforce plan parity.
2. Confirm required placeholder token presence per template.
3. Render representative fixture entity (`Invoice`) with stable timestamp.
4. Fail if unresolved tokens remain in rendered output.
5. Build isolated fixture workspace for generated outputs.
6. Typecheck rendered TypeScript outputs via local TypeScript compiler.
7. Report deterministic summary.

## Focused Tests Added

- `tests/tools/genesis/entity-template-validation.test.ts`

Coverage includes:
- service template family presence and validation
- validator template family presence and validation
- successful end-to-end validator CLI run

## Validation Outcome

- `npm run test:template-validation` passes.
- `npm run typecheck:templates` passes.

## Failure Semantics

Validator returns non-zero on:
- missing template files,
- missing required tokens,
- unresolved placeholder tokens after render,
- fixture typecheck failure,
- catalog/plan mismatch.
