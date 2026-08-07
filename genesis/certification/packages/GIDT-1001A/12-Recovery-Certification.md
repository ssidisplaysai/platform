# 12 Recovery Certification

Recovery certification result: PASS

Certified fail-closed behavior for:
- malformed JSON
- unsupported schema
- invalid manifest
- invalid identities and duplicate dimensional balances
- invalid quantities
- broken containment
- movement/ledger mismatch, missing links, and extra links
- duplicate serial assignment
- conflicting idempotency state and tenant contamination

Certified behavior:
- no partial initialization accepted as READY
- READY blocked on corruption
- projections rebuild deterministically
- metrics recompute deterministically
- versions and idempotency restore across restart
