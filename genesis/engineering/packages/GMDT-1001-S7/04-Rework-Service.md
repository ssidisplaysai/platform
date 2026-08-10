# 04 Rework Service

Service: manufacturing.service.rework

Behavior:
- Validates source and target operations belong to the same work order.
- Requires explicit routing rework edge from source step to target step.
- Uses operation rework transition plus quantity mutation to maintain deterministic history.
- Enforces idempotent replay and conflict rejection for changed payloads.