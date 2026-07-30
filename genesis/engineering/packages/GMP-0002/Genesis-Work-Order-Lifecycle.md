# Genesis Work Order Lifecycle

## Status Progression
- draft -> planned -> released
- released is a controlled release gate
- pause and resume are bounded transitions
- completion and closure are terminal governance steps
- cancellation is guarded against invalid terminal states

## Transition Controls
- Plan: only from draft
- Release: only from planned
- Pause: only from in_production
- Resume: only from paused
- Complete: only from in_production
- Cancel: blocked for completed or closed
- Close: only from completed or cancelled

## Governance Artifacts
Each accepted transition writes:
- Updated aggregate version
- Audit event
- Published event when contract-defined
