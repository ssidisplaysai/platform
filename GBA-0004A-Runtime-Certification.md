# GBA-0004A Runtime Certification

## Runtime Surfaces Validated
- Marketing runtime service behavior.
- In-memory and Prisma repository integration contracts.
- API forwarding routes.
- Protected workspace routing and page mode rendering.
- Recommendation generation and review lifecycle.
- Executive report generation.
- Health snapshot generation.
- Marketing Kernel data synthesis.

## Test Evidence
- tests/gba/gba-marketing-runtime.test.ts: PASS.
- tests/gba/gba-marketing-api.test.ts: PASS.
- tests/gba/gba-marketing-route-forwarding.test.ts: PASS.
- tests/gba/gba-marketing-authorization.test.ts: PASS.
- Full tests/gba regression: PASS (18 suites, 40 tests).

## Runtime Integrity Notes
- Marketing runtime reads from certified Marketing Kernel services when present.
- Timeline events and review events remain append-only and traceable.
- Workspace read and mutation permissions map to GOP action IDs and default-deny behavior.
- Deterministic replay probe on seeded recommendations returned stable results.

## Disposition
APPROVED.
