# GLW Capability Documentation

## Capability Authority
EAR is the declaration authority. EHC evaluates availability against declared capabilities.

## GLW Declared Capabilities
- catalog
- order-management
- page-generation

## Capability Flow
1. GLW declarations are registered in EAR metadata.
2. EHC consumes declared capabilities and computes availability advertisements.
3. GMC consumes EHC capability outputs for workspace and launch context.

## Boundary Rule
Mission Control does not own capability declaration inventory.

## Evidence
- src/platform/ear/seed.ts
- src/platform/ehc/service.ts
- src/platform/gmc/health-summary-service.ts
- tests/glw/genesis-platform-integration.test.ts
