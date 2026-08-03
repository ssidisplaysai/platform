# Timeout and Cancellation Architecture

## Implemented Controls
- Added explicit runtime guard and error taxonomy:
  - AICancelledError
  - AITimeoutError
- Added cancellation signal support in execution input and execution context.
- Enforced guard checks at execution start, planning boundary, tool loop entry, and provider execution boundary.

## Outcome Semantics
- Cancellation transitions result to CANCELLED with EXECUTION_CANCELLED audit event.
- Timeout transitions result to TIMED_OUT with EXECUTION_TIMED_OUT audit event.
- Metrics now distinguish cancelledCount and timedOutCount.

## Implementation References
- src/platform/ai/execution/index.ts
- src/platform/ai/contracts/index.ts
- src/platform/ai/metrics/index.ts
