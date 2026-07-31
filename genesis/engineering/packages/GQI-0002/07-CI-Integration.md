# CI Integration

## Workflow Updated

- `.github/workflows/atlas-guardrails.yml`

## CI Gate Flow (Updated)

1. Install dependencies (`npm ci`)
2. Generate Prisma client (`npx prisma generate`)
3. Run canonical quality gates (`npm run quality:ci`)
4. Run existing atlas guardrails (`npm run atlas:certify`)

## Canonical Local/CI Command Parity

CI uses package scripts, not duplicated YAML logic:
- `typecheck`
- `lint:quality-gate`
- `test:template-validation`
- `test:quality-regression`

This ensures local developer execution matches CI semantics.

## CI Effect on GQI-0002 Goals

- Typecheck gate availability in CI: achieved.
- Template validation availability in CI: achieved.
- Focused regression availability in CI: achieved.

## Practical Note

Prisma generation step added to reduce CI/environment variance before test and typecheck stages.
