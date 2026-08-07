# 03 Validator Registry

Implemented InventoryReferenceValidatorRegistry capabilities:
- registerValidator(referenceType, validator)
- registerProductValidator(legacy-compatible)
- requireValidator(referenceType)
- supports(referenceType)
- supportedReferenceTypes() deterministic ordering
- listValidatorIds() deterministic ordering
- getHealth(requiredTypes)

Guardrails:
- Duplicate registration rejected
- Missing mandatory validator classified as required-validator failure
