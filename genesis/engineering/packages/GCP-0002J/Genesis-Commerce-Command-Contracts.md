# Genesis Commerce Command Contracts

## Command Contract Principles
1. Commands express intent, not direct aggregate mutation.
2. Commands are validated at contract boundary.
3. Commands are authorization-scoped and auditable.
4. Command results are deterministic and typed.

## Canonical Command Set
- CreateOrder
- ApproveOrder
- ReleaseOrder
- CancelOrder
- ReviseOrder
- ConvertQuote

## Command Envelope
```yaml
CommandEnvelope:
  commandId: string
  contractVersion:
    major: integer
    minor: integer
    patch: integer
  commandType: string
  correlationId: string
  causationId: string | null
  timestamp: string
  actor:
    actorId: string
    roles: [string]
  organization:
    organizationId: string
    siteId: string | null
  authorization:
    requiredPermissions: [string]
  payload: object
  idempotencyKey: string
```

## Contract Expectations Per Command
1. Request schema
- Mandatory fields and domain constraints.

2. Validation rules
- Structural validity.
- Lifecycle precondition validity.
- Scope and identity validity.

3. Success responses
- Accepted.
- Completed with resulting aggregate snapshot reference.

4. Failure responses
- Validation.
- Authorization.
- Conflict.
- Dependency.
- Permanent failure.

## Authorization Expectations
1. CreateOrder requires create authority.
2. ApproveOrder requires approval authority.
3. ReleaseOrder requires release authority.
4. CancelOrder requires cancellation authority.
5. ReviseOrder requires revise authority.
6. ConvertQuote requires order creation authority plus quote conversion eligibility.

## Deterministic Response Contract
```yaml
CommandResponse:
  commandId: string
  status: accepted | completed | rejected
  resultRef:
    aggregateType: string
    aggregateId: string
    aggregateVersion: integer
  error:
    code: string
    category: validation | authorization | conflict | dependency | transient | permanent
    message: string
    retryable: boolean
  timestamp: string
```
