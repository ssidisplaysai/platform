# 12 Failure Model

Implemented deterministic failures:

1. invalid movement command
2. invalid movement type
3. invalid quantity
4. invalid Inventory Item
5. invalid balance
6. tenant mismatch
7. Inventory Item mismatch
8. invalid dimensional key
9. prohibited self-movement
10. insufficient quantity
11. stale source version
12. stale destination version
13. duplicate movement ID
14. duplicate ledger ID
15. duplicate idempotency key behavior through replay semantics
16. conflicting idempotency payload
17. ledger integrity violation
18. append-only violation
19. atomicity failure

Failure guarantee:

1. no partial state mutation after failure