# 10 Rework Edge Behavior

Rework behavior delivered as bounded routing-edge transitions:
- rework target must exist and be route-authorized.
- rework edge usage is bounded by maxIterations.
- invalid edge and limit-exceeded paths reject with explicit classifications.
- operation history is append-only; no destructive reset of prior history.

Full standalone rework service remains deferred to later slices.
