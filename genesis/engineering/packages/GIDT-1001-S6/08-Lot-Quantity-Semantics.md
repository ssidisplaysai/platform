# 08 Lot Quantity Semantics

Implemented lot quantity controls:
- trackedQuantity must be non-negative.
- trackedQuantity cannot exceed associated balance on-hand quantity when balance-scoped.
- direct arbitrary negative or inconsistent mutation is rejected.
- lot quantity semantics remain identity/state-level and do not introduce alternate movement engine behavior.
