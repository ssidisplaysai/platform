# 15 Movement And Ledger Model

Movement purpose:

- Represent canonical stock state transitions as explicit facts.

Movement types:

1. Receive
2. PutAway
3. Pick
4. Pack
5. Ship
6. Consume
7. Return
8. TransferOut
9. TransferIn
10. AdjustIncrease
11. AdjustDecrease
12. Reconcile
13. Quarantine
14. ReleaseFromQuarantine
15. Expire
16. Dispose

Ledger model:

1. InventoryLedgerEntry is immutable and append-only.
2. Each movement yields one or more ledger entries.
3. Ledger entries include before/after quantity perspectives by scope.
4. Ledger entries include causation/correlation identifiers.

Conservation constraints:

1. Internal transfers preserve tenant-level total OnHand quantity.
2. External flows (receive/ship/consume/dispose) change tenant-level OnHand as expected.
3. Reversals create compensating facts, never destructive rewrites.

Reconciliation posture:

1. Reconciliation produces explicit adjustment movements.
2. Adjustment reason is mandatory.
3. Adjustment actor context is mandatory.