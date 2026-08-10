# 18 Validation Matrix Report

Environment:
- timestamp: 2026-08-10T10:22:54.7552308-07:00
- os: Microsoft Windows 11 Pro
- node: v24.18.0
- npm: 11.16.0
- jest: 30.4.1

Required commands executed:
- npm run typecheck: pass
- npm run test:template-validation: pass
- npm run quality:ci: pass
- npm run test:quality-regression: pass
- npm test -- --runInBand tests/manufacturing: pass
- npm test -- --runInBand tests/shared: pass
- npm test -- --runInBand tests/knowledge: pass
- npm test -- --runInBand tests/product: pass
- npm test -- --runInBand tests/inventory: pass
- npm test -- --runInBand tests/manufacturing/gmdt-1001-s7-production-output-yield-scrap-rework-wip.test.ts: pass