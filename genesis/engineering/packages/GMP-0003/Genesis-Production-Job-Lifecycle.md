# Genesis Production Job Lifecycle

## Lifecycle Functions
- `queueProductionJob`
- `readyProductionJob`
- `releaseProductionJob`
- `startProductionJob`
- `pauseProductionJob`
- `resumeProductionJob`
- `completeProductionJob`
- `cancelProductionJob`
- `closeProductionJob`

## Contract Behavior
- Each transition validates current status.
- Invalid transitions return validation failure, not silent mutation.
- Valid transitions increment version, append timeline entry, append audit event, and publish enterprise event.

## Determinism Guarantees
- Single aggregate write path through repository mutation boundary.
- Transition logic centralized in aggregate functions.
- Status changes produce explicit event type payloads for downstream consumers.

## Lifecycle Boundary
Lifecycle captures authorization and state authorization only. It does not perform machine/operations execution.
