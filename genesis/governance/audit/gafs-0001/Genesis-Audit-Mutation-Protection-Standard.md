# Genesis Audit Mutation Protection Standard

## Mutation Protection Rule
Audit execution shall prohibit unintended repository modifications.

## Mandatory Controls
1. Pre-audit repository snapshot capture.
2. Post-audit repository snapshot capture.
3. Allowed output boundary declaration.
4. Mutation diff verification against allowed boundaries.
5. Mutation violation fails audit validation.

## Enforcement Requirements
- Machine-readable mutation check record is mandatory.
- Any mutation outside allowed output boundaries must be recorded as critical process failure.

## Machine Reference
- [machine/validation-registry.schema.json](machine/validation-registry.schema.json)