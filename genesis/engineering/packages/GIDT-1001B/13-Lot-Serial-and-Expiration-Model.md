# 13 Lot Serial And Expiration Model

Lot model:

1. Lot binds grouped stock to batch identity.
2. LotCode uniqueness scope is tenant + product.
3. Lot may carry manufacture date, best-before date, expiration date.

Serial model:

1. SerialNumber tracks individual unit identity.
2. SerialCode uniqueness scope is tenant + product.
3. One serial unit maps to one active location at a time.

Expiration model:

1. ExpirationRecord governs date-state interpretation.
2. Expired status blocks new allocation by default.
3. Requalification requires explicit policy and audit fact.

Traceability rules:

1. Movement facts preserve lot/serial references where applicable.
2. Reservation/allocation may target lot/serial constraints.
3. Pick/pack/ship semantics must maintain trace chain continuity.

Quality and quarantine posture:

1. Quarantine state prevents allocatable availability.
2. Release from quarantine requires explicit state transition fact.
3. Expired and quarantined states are independently modeled.