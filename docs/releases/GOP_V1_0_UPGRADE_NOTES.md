# GOP v1.0 Upgrade Notes

## Database

Two additive migrations are expected in environments upgrading from pre-GOP-0005 baselines:

- 20260726093000_gop_execution_store
- 20260726103000_gop_runtime_fabric

No destructive migration steps are required for v1.0 adoption.

## Worker Protocol Secret

Set GOP_WORKER_TOKEN_SECRET to enable signed worker protocol endpoints.

## Operational Endpoints Added

- /api/gop/executions
- /api/gop/executions/:id
- /api/gop/executions/:id/history
- /api/gop/executions/:id/replay
- /api/gop/workers/protocol/*
- /api/gop/dead-letters/*

## Backward Compatibility

- Existing GLW callback endpoints and payload contracts are unchanged.
- Existing session-based worker control endpoints remain available.
- Existing operations stream endpoints remain available and additive.
