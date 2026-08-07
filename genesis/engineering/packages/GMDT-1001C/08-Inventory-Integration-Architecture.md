# 08 Inventory Integration Architecture

Manufacturing consumes Inventory through bounded contracts only.

Integration ports:
- availability inquiry
- reservation request
- allocation request
- reservation release
- allocation release
- material issue or movement request
- material return request
- consumption movement reference
- finished-goods receipt request
- scrap or write-off request
- lot or serial trace validation
- inventory movement lookup or reference

Per-port rule set:
- command/query direction is explicit
- authority remains Inventory for stock mutation
- idempotency required for every command port
- correlation ID required for every cross-platform call
- expected versions required where Inventory exposes them
- failures must not produce false Manufacturing consumption or output finalization
- retries are safe only when idempotency semantics permit replay
- audit linkage records request and returned reference or rejection reason

Resulting Manufacturing state:
- request state is tracked independently from Inventory stock state
- manufacturing issue/receipt/return/output facts finalize only after required Inventory acceptance semantics are satisfied

No direct foreign persistence access is permitted.
