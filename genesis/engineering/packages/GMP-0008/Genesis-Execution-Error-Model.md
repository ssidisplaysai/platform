# Genesis Execution Error Model

## Error Categories
- Execution conflict
- Concurrency
- Invalid transition
- Missing dependency
- Timeout
- External dependency unavailable
- Retryable
- Non-retryable

## Rules
- Error categories must be versioned and deterministic.
- Retryability must be explicit.
- Error contracts must be observable and auditable.
