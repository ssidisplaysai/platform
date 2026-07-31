# Template Strategy

## Template Inventory

Path: tools/genesis/templates

Groups:
1. core-object-system
- Concrete template artifacts (TypeScript and markdown) intended for deterministic scaffold output.

2. entity
- Placeholder templates (*.template.ts and *.template.md)
- Runtime renderer: TemplateRenderer.mjs

Measured placeholder scope (entity templates):
- Files: 8 TypeScript template files
- Total lines: 600
- Placeholder tokens: 161

## Classification Standard

1. Compile-time templates
- Definition: Templates that are valid source files as-is and may be typechecked directly.
- Rule: Keep in repository typecheck scope.

2. Runtime templates
- Definition: Templates consumed by rendering/runtime tooling and not expected to compile before token substitution.
- Rule: Exclude from repository tsc gate; validate through renderer tests.

3. Scaffold templates
- Definition: Source stubs used to generate project artifacts.
- Rule: Validate render determinism and output compileability in isolated fixture pipelines.

4. Placeholder templates
- Definition: Files containing unresolved token syntax (for example {{EntityName}}).
- Rule: Explicitly isolated from compile/lint gates that assume final syntax.

## Deterministic Handling Policy

1. TypeScript gate exclusion policy
- Exclude placeholder template files from root tsconfig include path, or include them only in a dedicated template tsconfig configured for token-aware checks.

2. Template render validation policy
- Add deterministic tests that render each template using fixed fixture inputs.
- Require zero unresolved tokens after render.
- Require generated output to pass tsc/lint in an isolated temporary workspace.

3. Template test policy
- Maintain snapshot and structural tests for rendered outputs.
- Include required token contract test ensuring all declared tokens are replaced.

4. Template documentation policy
- Every template group must document:
  - token set
  - output destinations
  - required post-render quality checks
  - ownership and maintenance process

5. Template CI policy
- Add dedicated template workflow and quality gate stage:
  - template:validate
  - template:render-test
  - template:compile-test

## Outcome Target

Placeholder templates are treated as intentional source artifacts with explicit quality controls, not as raw platform code expected to pass repository compile checks directly.
