# 11 Quarantine Behavior

Implemented quarantine semantics:
- Lot and serial can transition to QUARANTINED through explicit command actions.
- Release from quarantine requires explicit command and version checks.
- Release is rejected when expiration state is EXPIRED.
- Quarantine behavior affects eligibility state only and does not alter physical quantity.
- Movement and ledger history authority remains Slice 4.
