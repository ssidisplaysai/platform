# Genesis Production Job Audit Model

## Audit Intent
Provide action-level accountability for lifecycle transitions, revisions, and aggregate updates.

## Event Envelope
- Event ID
- Aggregate ID and type
- Action name
- Actor
- Timestamp
- Optional metadata details

## Audit Sources
- Creation and conversion from Work Order
- Status transitions
- Revision creation
- Draft updates

## Access
Audit retrieval is exposed through repository and API route:
- GET `/api/production-jobs/{productionJobId}/audit`

## Security
Audit endpoints require explicit read/audit permissions and organization scope alignment.
