# 12 Quantity And Availability Model

Quantity vocabulary:

1. OnHandQuantity: physically present stock.
2. ReservedQuantity: stock held by reservation intent.
3. AllocatedQuantity: reserved stock committed to execution.
4. AvailableQuantity: stock eligible for new reservation.
5. IncomingQuantity: expected not-yet-received stock.
6. OutgoingQuantity: committed outbound stock not yet decremented from OnHand when policy stages shipping.

Core equations:

1. AvailableQuantity = OnHandQuantity - ReservedQuantity - NonAllocatableHolds
2. ReservedQuantity >= AllocatedQuantity
3. OnHandQuantity >= 0
4. AvailableQuantity >= 0

NonAllocatableHolds examples:

1. Quarantine hold
2. Quality hold
3. Regulatory hold
4. Damage hold

Measurement rules:

1. Quantity values carry explicit UnitOfMeasure.
2. Arithmetic only between compatible units.
3. Conversion rules must be deterministic and explicitly defined by policy.
4. Rounding policy is explicit and deterministic.

Consistency rules:

1. Quantity updates occur through movement semantics, not direct overwrite.
2. Snapshot materialization does not alter canonical ledger facts.
3. Quantity reconciliation emits explicit adjustment facts.