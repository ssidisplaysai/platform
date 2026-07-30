# Genesis Commerce Platform Reorder Policy

## Policy Intent
Provide bounded reorder recommendation foundations from inventory state without external procurement execution.

## Inputs
1. Product lifecycle and enabled metadata.
2. Location-scoped available quantity.
3. Reorder threshold and target levels.
4. Optional demand-signal placeholders where present in contract.

## Decision Contract
1. reorderRecommended boolean.
2. suggestedReorderQuantity.
3. explanatory policy context fields.

## Rule Baseline
1. Reorder recommendation is only actionable for non-archived/non-suspended lifecycle states.
2. Recommendation triggers when available quantity is below configured threshold.
3. Suggested reorder quantity is bounded to non-negative deterministic value.
4. Policy remains deterministic and side-effect free.

## Out of Scope
1. Purchase order generation.
2. Supplier optimization logic.
3. Dynamic lead-time forecasting.
