# 06 Cycle Test Evidence

Focused Product tests now assert:

BOM:

1. Direct self-cycle rejection.
2. Two-node/multi-level indirect cycle rejection.
3. Valid acyclic hierarchy acceptance.
4. No partial mutation after rejection.
5. Persisted cyclic-state recovery rejection.

Configuration:

1. Direct self-dependency rejection.
2. Two-rule mutual cycle rejection.
3. Multi-node dependency cycle rejection across configurations.
4. Valid acyclic dependency behavior.
5. No partial mutation after rejection.
6. Persisted cyclic-state recovery rejection.

Relationship recursion:

1. Replacement-cycle rejection for REPLACES graph recursion constraints.

Assertion quality:

1. Tests assert deterministic error code INVARIANT_VIOLATION.
2. Tests assert state counts before/after rejected operations.
3. Tests assert audit evidence and cycle counters where applicable.