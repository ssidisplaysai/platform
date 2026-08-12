# Health API Documentation

Work Order: EHC-1001
Date: 2026-07-30

## Endpoints

- GET /api/ehc/health/current
- GET /api/ehc/health/enterprise
- GET /api/ehc/health/application/{applicationId}
- POST /api/ehc/health/application/{applicationId}
- GET /api/ehc/health/application/{applicationId}/history
- GET /api/ehc/health/application/{applicationId}/capabilities
- POST /api/ehc/health/application/{applicationId}/compatibility
- GET /api/ehc/health/application/{applicationId}/readiness
- GET /api/ehc/health/application/{applicationId}/liveness

## Behavior Summary

- current health: latest enterprise summary
- enterprise health: full aggregation snapshot
- application health: current health record by application
- evaluate application health: evaluate and record new health observation
- history: health observation history by application
- capabilities: capability advertisement status by application
- compatibility: compatibility assessment by application
- readiness: current readiness status by application
- liveness: current liveness status by application

## Error Handling

- 404 for unknown application in certified registry or missing health record
- 400 for malformed payload requirements
- 200/201 for successful operations
