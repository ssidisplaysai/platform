# Budget Enforcement Architecture

## Implemented Controls
- Added execution-scoped budget state for token and cost consumption.
- Added guard enforcement for token and cost overflow with AIBudgetExceededError.
- Applied budget accounting to:
  - Tool stage (deterministic charge)
  - Provider response stage (token/cost charge)
- Added rejected/exhausted observability:
  - budgetRejectedCount
  - budgetExhaustedCount

## Failure Semantics
- Budget policy violations produce deterministic FAILED outcomes.
- Audit includes BUDGET_GUARD stage metadata and consumed budget counters.

## Implementation References
- src/platform/ai/execution/index.ts
- src/platform/ai/metrics/index.ts
- src/platform/ai/contracts/index.ts
