# 07 Quantity and Availability Validation

Quantity and availability validation result: PASS

Independent findings:
- negative quantities are rejected
- availability is validated against canonical balance math
- reservation semantics and allocation semantics are coherent and separately modeled
- reservation-to-allocation conversion preserves quantity without drift
- quarantine semantics affect availability and health correctly
- movement applies quantity exactly once per affected balance
- idempotent replay does not reapply quantity
- restart and recovery preserve quantity state
- lot quantity and serial unit-level semantics remain consistent with balance state

Evidence sources:
- domain invariants tests
- Slice 4 movement/ledger tests
- Slice 5 reservation/allocation tests
- Slice 9 persistence/recovery tests
