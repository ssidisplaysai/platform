# Genesis Commerce Platform Manufacturer Model

## Manufacturer Contract
Each manufacturer record includes:
1. Stable manufacturer identity and organization scope.
2. Name, displayName, slug, optional website.
3. Status lifecycle (active, suspended, archived).
4. Optional Business Genome reference.
5. Notes for bounded operational context.

## Guardrails
1. Product manufacturer references are validated.
2. Invalid manufacturer IDs are rejected on create/update.
3. Manufacturer records remain non-secret metadata only.
