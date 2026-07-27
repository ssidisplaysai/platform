# GEA-0004 Workflow Engine

## Capabilities
- Compile orchestration/workflow definitions into immutable versions.
- Execute sequential, parallel, fan-in, and conditional patterns.
- Resolve dependency graph ordering and detect cycles.
- Apply retry policy and compensation capture for failed stages.
- Persist snapshots and timeline transitions for replay and audit.

## Execution Flow
1. Workflow compile creates orchestration + workflow definition + version checksum.
2. Start initializes execution state, immutable lineage, and first snapshot.
3. Coordinator resolves runnable steps by dependency state.
4. Agent runtime execution produces step transition updates.
5. Terminal state writes final snapshot and timeline.

## Determinism
- Replay checksum includes canonical workflow identity plus normalized execution state.
- Event-driven or calendar-triggered scheduling marks replay as PARTIAL due to external trigger dependence.

## Failure Semantics
- Dependency cycles are detected and produce failed execution state.
- Retry counters and compensation actions are persisted for recovery use.
