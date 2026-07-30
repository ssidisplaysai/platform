# Genesis Commerce Platform Inventory Reservation Model

## Reservation Contract
Inventory reservations include:
1. reservationId, organizationId, productId, locationId, siteId.
2. quantity and unitOfMeasure.
3. reservationType and reference metadata.
4. requestedBy, status lifecycle metadata.
5. expiresAt and audit timestamps.
6. release/fulfillment actor metadata.

## Reservation Lifecycle Foundations
1. create: reserves quantity when sufficient availability exists.
2. release: returns reserved quantity and is idempotent for already released state.
3. fulfill: finalizes reservation and blocks duplicate fulfillment.
4. expire: transitions stale active reservations when expiry conditions are met.

## Reservation Guardrails
1. Reservation quantity must be positive.
2. Requested quantity cannot exceed available quantity.
3. Reservation operations are organization/location scoped.
4. Release and fulfill operations validate current reservation state.
