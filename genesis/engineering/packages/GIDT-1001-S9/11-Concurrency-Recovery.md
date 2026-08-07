# 11 Concurrency Recovery

Versioned Inventory records survive restart with their version state intact.

Stale expected-version writes continue to fail after recovery, which preserves concurrency semantics across restarts.