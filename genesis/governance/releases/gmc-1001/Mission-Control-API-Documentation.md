# Mission Control API Documentation

Work Order: GMC-1001
Date: 2026-07-30

## Endpoints

- GET /api/gmc/workspace
- GET /api/gmc/applications
- GET /api/gmc/applications?mode=filters
- GET /api/gmc/navigation
- GET /api/gmc/dashboard
- GET /api/gmc/launch-metadata/{applicationId}
- GET /api/gmc/search?q=
- GET /api/gmc/health-summary

## Contracts

- workspace model payload
- dynamic application catalog payload
- dynamic navigation payload
- dashboard summary payload
- launch metadata payload
- search results payload
- enterprise health summary payload

## Error Handling

- 404 for unknown application launch metadata
- 200 for successful retrieval operations
