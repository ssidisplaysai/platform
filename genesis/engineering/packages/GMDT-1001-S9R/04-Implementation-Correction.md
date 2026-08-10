# 04 Implementation Correction

Code corrections applied:
1. Added external family authority declaration type and registration field:
- ManufacturingExternalReferenceFamily
- ManufacturingIntegrationRegistration.externalReferenceFamilies?

2. Replaced first-wins startup behavior in ManufacturingReferenceValidationService:
- Removed silent skip for pre-registered family in external validator loop.
- Added explicit authoritative family selection per integration:
  - use declared externalReferenceFamilies when provided,
  - fallback to legacy full external family list only when none provided.
- registerValidator now throws DUPLICATE_REFERENCE_VALIDATOR on duplicate family authority.

3. Runtime wiring update:
- Thread externalReferenceFamilies from integration registrations into ManufacturingReferenceValidationService constructor.
- In slice 09g registration catch path, map DUPLICATE_REFERENCE_VALIDATOR domain error to PARTIAL_INITIALIZATION_REJECTED runtime failure (fail closed).

4. Failure taxonomy update:
- Added DUPLICATE_REFERENCE_VALIDATOR in manufacturing failure classifications.
