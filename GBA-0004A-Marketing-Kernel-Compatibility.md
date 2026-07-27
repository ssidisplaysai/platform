# GBA-0004A Marketing Kernel Compatibility

## Compatibility Statement
The Marketing Agent is architected as an orchestration and intelligence layer above the certified Marketing Kernel Platform. It consumes kernel data and services rather than duplicating kernel execution.

## Verified Boundaries
- Consumes Marketing Kernel analytics services.
- Consumes Marketing Kernel recommendation services.
- Synthesizes local marketing planning and review artifacts.
- Does not bypass Marketing Kernel APIs.
- Does not recreate publishing execution.
- Does not recreate SEO automation.
- Does not recreate AI content generation execution.
- Does not recreate workflow scheduling.
- Does not recreate media generation.

## Evidence
- Runtime unit tests passed against the marketing runtime.
- The runtime tolerates sparse or absent kernel data and degrades safely.
- Seeded replay probe remained deterministic for recommendation outputs.

## Disposition
APPROVED.
