# 02 Movement Model

Implemented movement fields:

1. movement ID
2. tenant ID
3. Inventory Item ID
4. source balance and dimensional scope where applicable
5. destination balance and dimensional scope where applicable
6. quantity
7. movement type
8. reason
9. idempotency key
10. correlation metadata
11. command metadata
12. expected source and destination versions where applicable
13. resulting source and destination versions where applicable
14. audit metadata
15. creation timestamp
16. ledger entry identifiers

Supported movement types in Slice 4:

1. ADJUST_INCREASE
2. ADJUST_DECREASE
3. INTERNAL_MOVE
4. QUARANTINE
5. RELEASE_FROM_QUARANTINE
6. WRITE_OFF

Deferred explicitly:

1. receiving
2. picking
3. packing
4. shipping
5. production consumption
6. production receipt