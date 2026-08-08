# 08 Operation Prerequisites

Prerequisite enforcement implemented for start eligibility:
- structural predecessors must be complete/skipped/closed.
- successor operations cannot start prematurely.
- operation completion requires valid prior start state.
- start operation is blocked when Work Order is not execution-compatible.

No operation command bypasses Work Order lifecycle/readiness gates.
