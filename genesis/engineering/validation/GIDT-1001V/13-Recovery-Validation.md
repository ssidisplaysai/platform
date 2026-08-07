# 13 Recovery Validation

Recovery validation result: PASS

Confirmed recovery rejects:
- malformed JSON
- unsupported schema
- invalid manifest shape
- duplicate IDs and duplicate dimensional balances
- invalid quantities
- broken containment
- movement/ledger mismatch
- missing ledger linkage
- extra ledger linkage
- duplicate serial assignment
- cross-tenant contamination

Confirmed recovery behavior:
- READY not reached on blocking recovery failure
- first-run absent state is distinct from corrupt state
- derived projections rebuild deterministically
- metrics recompute deterministically
- versions survive restart
- idempotency survives restart
