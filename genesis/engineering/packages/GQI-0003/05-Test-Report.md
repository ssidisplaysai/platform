# 05 Test Report

## Focused Validation
### AI
Command:
- `npm test -- --runInBand tests/ai`

Result:
- suites: 1 passed
- tests: 9 passed
- failures: 0

### GOP
Command:
- `npm test -- --runInBand tests/gop`

Result:
- suites: 27 passed
- tests: 67 passed
- failures: 0

## Canonical Quality Gates
### Typecheck
- `npm run typecheck`: passed

### Template validation
- `npm run test:template-validation`: passed

### Quality CI
- `npm run quality:ci`: passed

### Quality regression
- `npm run test:quality-regression`: passed
