# 15 Corrupt State Handling

Corrupt state behavior is fail-closed.

Recovery rejects and blocks READY for:
- unsupported schema
- malformed manifest JSON
- invalid manifest shape
- missing tenant partition file declared by manifest
- duplicate work order id
- duplicate work order number
- routing cycle or missing step reference
- broken output or trace local relationships
- invalid idempotency key state
- tenant partition payload mismatch

No silent repair or destructive rewrite is performed.
