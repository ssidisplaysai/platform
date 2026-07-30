# Genesis Error Model

## Error Categories
- Validation failures
- Authorization failures
- Conflict
- Concurrency
- Dependency unavailable
- Timeout
- Retryable
- Non-retryable

## Rules
- Errors must be explicit and machine-readable.
- Error semantics must remain versioned and contract-first.
- Retryable and non-retryable outcomes must be distinguishable.
