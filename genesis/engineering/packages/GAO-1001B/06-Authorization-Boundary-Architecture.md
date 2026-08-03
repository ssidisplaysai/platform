# Authorization Boundary Architecture

## Implemented Controls
- Added AIAuthorizationRequest and AIAuthorizationDecision contract types.
- Added resolver-backed authorization function boundary in execution engine.
- Added decision cache with TTL to reduce repeated resolver calls.
- Enforced fail-closed behavior when resolver is absent.
- Propagated authorization policy and provenance into tool execution audit details.

## Provenance Requirements
- Decision includes policyId, cacheHit, evaluatedAt, and provenance metadata:
  - source
  - principalId
  - actionId
  - workspaceId
  - requestId

## Observability
- Added authorizationDeniedCount and authorizationErrorCount metrics.
- Denied tool execution writes TOOL_REJECTED records with decision provenance.

## Implementation References
- src/platform/ai/contracts/index.ts
- src/platform/ai/execution/index.ts
- src/platform/ai/runtime/index.ts
- tests/ai/gao-1001-foundation.test.ts
