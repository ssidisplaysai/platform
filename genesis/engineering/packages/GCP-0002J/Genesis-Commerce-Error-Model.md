# Genesis Commerce Error Model

## Error Categories
1. Validation errors
2. Authorization errors
3. Conflict errors
4. Dependency errors
5. Transient errors
6. Permanent failures

## Canonical Error Contract
```yaml
ContractError:
  errorId: string
  category: validation | authorization | conflict | dependency | transient | permanent
  code: string
  message: string
  details: object
  retryable: boolean
  correlationId: string
  causationId: string | null
  timestamp: string
```

## Semantics
1. Validation
- Input or schema invalidity.
- retryable is false until request is corrected.

2. Authorization
- Permission or scope violation.
- retryable is false without security-context change.

3. Conflict
- Version mismatch, lifecycle conflict, duplicate intent.
- retryable is conditional after state refresh.

4. Dependency
- Required external contract or upstream prerequisite unavailable.
- retryable depends on dependency recovery.

5. Transient
- Timeout, transport interruption, temporary unavailability.
- retryable is true under retry policy.

6. Permanent
- Non-recoverable business or contract failure.
- retryable is false and may dead-letter.

## Error Compatibility
1. Error contract itself is versioned.
2. New error codes are additive.
3. Existing code semantics are immutable within major version.
