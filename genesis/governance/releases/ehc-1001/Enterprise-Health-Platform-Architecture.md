# Enterprise Health Platform Architecture

Work Order: EHC-1001
Date: 2026-07-30

## Architecture Components

1. Domain model
- src/platform/ehc/types.ts

2. Repository abstraction
- src/platform/ehc/repository.ts

3. Health evaluation engine
- src/platform/ehc/evaluation-engine.ts

4. Capability advertisement engine
- src/platform/ehc/capability-engine.ts

5. Aggregation engine
- src/platform/ehc/aggregation-engine.ts

6. Service layer
- src/platform/ehc/service.ts

7. Runtime composition
- src/platform/ehc/runtime.ts

8. Internal API boundary
- src/lib/ehc/health-api.ts
- src/app/api/ehc/health/*

## Dependency Direction

EAR service
-> EHC service
-> EHC repository and engines
-> EHC API handlers
-> EHC API routes

No Mission Control, Health endpoint polling, authentication, or UI dependencies exist in EHC implementation scope.

## Replaceable Persistence

Service depends only on EnterpriseHealthRepository interface.

Future persistence adapters can be introduced without changing service contracts.
