# 03 Quantity Model Hardening

Quantity hardening result: PASS

Validated invariants:
- no negative quantity allowed across balances/reservations/allocations
- available quantity formula enforced as onHand - reserved - allocated - hold
- movement updates quantities exactly once per affected balance
- reservation updates reserved commitment only
- allocation updates allocated commitment only
- reservation-to-allocation conversion preserves conservation and avoids drift
- quarantine/unavailable semantics represented via hold/status paths
- serialized identity constraints remain separate from quantity cardinality assumptions
- restart/recovery preserves exact quantity states

Additional S10 evidence added:
- reservation/allocation/conversion operations explicitly verified to produce zero physical movement records and zero ledger records

Blocking quantity gaps found: none
