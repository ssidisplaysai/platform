# 00 Manifest

Work order:
- GMDT-1001-S3

Primary source changes:
- src/platform/manufacturing/contracts/types.ts
- src/platform/manufacturing/index.ts
- src/platform/manufacturing/queries/ManufacturingFoundationQueryService.ts
- src/platform/manufacturing/runtime/factory.ts
- src/platform/manufacturing/runtime/types.ts
- src/platform/manufacturing/services/ManufacturingWorkOrderService.ts
- src/platform/manufacturing/services/ProductionRunService.ts
- src/platform/manufacturing/services/ProductionBatchService.ts

Primary test changes:
- tests/manufacturing/gmdt-1001-s2-runtime-composition.test.ts
- tests/manufacturing/gmdt-1001-s3-work-order-foundation.test.ts

Validation matrix:
- npm run typecheck
- npm run test:template-validation
- npm run quality:ci
- npm run test:quality-regression
- npm test -- --runInBand tests/manufacturing/gmdt-1001-s3-work-order-foundation.test.ts
- npm test -- --runInBand tests/manufacturing
- npm test -- --runInBand tests/shared
- npm test -- --runInBand tests/knowledge
- npm test -- --runInBand tests/product
- npm test -- --runInBand tests/inventory
