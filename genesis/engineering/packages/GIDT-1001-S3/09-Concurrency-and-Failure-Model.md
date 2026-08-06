# 09 Concurrency And Failure Model

Expected-version behavior:

1. mutable entity operations require expected version
2. stale expected version rejects deterministically
3. accepted mutation increments version
4. immutable identity is enforced on mutable metadata operations
5. no silent last-write-wins behavior exists

Implemented deterministic failure classifications:

1. duplicate Inventory Item
2. duplicate Product reference mapping
3. invalid Product reference
4. duplicate Warehouse code
5. invalid Warehouse
6. duplicate Location code
7. invalid Location parent
8. recursive containment
9. duplicate Bin code
10. invalid Bin parent and missing Bin
11. duplicate Balance
12. invalid dimensional key
13. quantity invariant failure
14. tenant isolation violation
15. stale expected version
16. invalid lifecycle transition
17. missing required validator

Mutation safety:

1. validation precedes state mutation
2. rejected operations do not partially mutate Inventory foundation state