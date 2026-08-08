# 07 Test Design and Evidence

Focused Slice 5 test suite:
- tests/manufacturing/gmdt-1001-s5-product-bom-material-requirements.test.ts

Coverage points:
- Product baseline validation and freeze state progression.
- Deterministic material derivation from BOM lines and planned quantity.
- Material query ordering and readiness projection truthfulness.
- Idempotent replay acceptance and conflicting replay rejection.
- Invalid Product BOM reference rejection via bounded Product integration.

Regression updates:
- Runtime composition expectations updated for Slice 5 registration.
- Slice 3 and Slice 4 boundary assertions updated to allow material services while continuing to exclude output/persistence services.
