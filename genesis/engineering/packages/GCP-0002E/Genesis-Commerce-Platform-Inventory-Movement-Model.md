# Genesis Commerce Platform Inventory Movement Model

## Movement Contract
Inventory movement records include:
1. movementId, organizationId, productId.
2. sourceLocationId and destinationLocationId as nullable directional fields.
3. movementType and reasonCode.
4. quantity and unitOfMeasure.
5. Reference metadata (referenceType/referenceId).
6. actorReference, correlationId, idempotencyKey.
7. reversal and linkage metadata.
8. createdAt and updatedAt.

## Supported Movement Foundations
1. receipt
2. issue
3. transfer
4. adjustment_increase
5. adjustment_decrease
6. count_correction

## Validation and Invariants
1. Quantity must be positive.
2. Product and required location references must exist in scope.
3. Transfer requires distinct source and destination.
4. Issue/transfer cannot overdraw available stock constraints.
5. Idempotency key replays return existing movement outcome.
6. Reversal is controlled and blocked when already reversed.

## Bounded Behavior
1. Movements update fixture-backed stock maps deterministically.
2. Reversal executes as a bounded inverse movement contract.
3. No external WMS transaction authority is introduced.
