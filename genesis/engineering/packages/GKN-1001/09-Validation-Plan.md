# 09 Validation Plan

Validation commands:

1. npm run typecheck:app
2. npm test -- --runInBand tests/knowledge/gkn-1001-knowledge-foundation.test.ts
3. npm test -- --runInBand tests/gop/mission-control-knowledge.test.ts

Validation targets:

1. Runtime and platform type integrity.
2. Knowledge foundation service behavior.
3. Persistence and restart determinism.
4. Mission Control observability authorization and payload behavior.
