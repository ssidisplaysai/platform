# Template Remediation

## Strategy Applied

Least-invasive valid strategy from work order preference order:
1. Preserve templates as templates.
2. Exclude non-standalone placeholder templates from application compilation.
3. Add deterministic template validation for rendered outputs.

## Implemented Changes

1. Compiler scoping
- Added `tsconfig.typecheck.json`.
- Excluded `tools/genesis/templates/entity/*.template.ts` from application typecheck scope.
- Added explicit include set for intended application and certification-critical surfaces.

2. Placeholder handling
- No template files deleted.
- No broad exclusion of tools/ directory.
- No strictness weakening changes.
- No blanket suppression directives introduced.

3. Template validation infrastructure
- Added `tools/genesis/templates/entity/validate-templates.mjs`.
- Validation behavior:
  - catalog discovery and mismatch detection,
  - required-token validation,
  - deterministic fixture rendering,
  - unresolved-token failure,
  - generated output TypeScript validation in isolated fixture workspace.

## Renames

- Template files renamed: none.
- Rationale: Existing `.template.ts` naming remains semantically clear; compile contamination resolved through scoped gate + explicit validator.

## Result

Placeholder templates no longer contaminate canonical repository typecheck while retaining generator semantics and explicit validation.
