# GLW Health Participation Documentation

## Participation Model
GLW health participation is implemented by delegating to certified EHC handlers.

## GLW Health Routes
1. /api/glw/health
   - Delegates to EHC application health retrieval for applicationId glw.
2. /api/glw/capabilities
   - Delegates to EHC capability status retrieval for applicationId glw.

## Ownership Constraints
1. GLW does not implement enterprise aggregation logic.
2. GLW does not implement compatibility policy logic.
3. EHC remains health authority and source of compatibility/readiness/liveness state.

## Evidence
- src/app/api/glw/health/route.ts
- src/app/api/glw/capabilities/route.ts
- src/lib/ehc/health-api.ts
- tests/glw/genesis-platform-integration.test.ts
