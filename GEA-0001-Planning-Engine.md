# GEA-0001 Planning Engine

## Components
1. createTaskPlanner in src/lib/gea/planning-engine.ts.
2. createDependencyResolver in src/lib/gea/planning-engine.ts.
3. createPlanGenerator in src/lib/gea/planning-engine.ts.
4. createExecutionPlanner in src/lib/gea/planning-engine.ts.

## Deterministic Behavior
1. Capability inputs are sorted by capabilityKey.
2. Dependency resolver applies stable traversal order and cycle detection.
3. dependencyChecksum is computed from task dependency material only.
4. Repeated generation with equivalent input produces matching checksum.

## Integrity Constraints
1. Missing dependency references throw explicit errors.
2. Circular dependencies throw explicit errors.
3. Plans marked immutableAfterStart are guarded during execution startup.

## Approval Triggering
Tasks requiring finance or publishing capabilities are flagged requiresApproval by default in v1.
