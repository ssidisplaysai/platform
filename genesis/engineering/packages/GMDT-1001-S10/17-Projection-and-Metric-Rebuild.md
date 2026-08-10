# 17 Projection and Metric Rebuild

Rebuild strategy:
- canonical state is restored first
- derived projections remain recomputable and are not treated as canonical truth
- persistence coordinator triggers metrics and health recomputation after hydration
- persistence/recovery counters are persisted via recovery coordinator status and metrics
- event-derived operational gauges recalculate from restored canonical state
