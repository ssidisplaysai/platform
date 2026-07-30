# Genesis Execution Lifecycle

## Lifecycle States
- Created
- Ready
- Waiting
- Running
- Paused
- Blocked
- Resumed
- Completed
- Cancelled
- Failed
- Recovered
- Archived

## Lifecycle Rules
- State transitions are deterministic.
- Invalid transitions are prohibited.
- Terminal states are immutable.
- Lifecycle changes do not alter planning ownership.
- Lifecycle changes do not imply machine connectivity or MES behavior.
