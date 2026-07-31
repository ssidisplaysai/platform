# Mission Control Integration

## API Surface

1. GET /api/gop/workflow/health
- Returns workflow capability metadata, synthesized health status, and readiness counters.

2. GET /api/gop/workflow/metrics
- Returns workflow capability metadata, metrics snapshot, health snapshot, and readiness counters.

## GOP Aggregate Metrics Integration

The GOP metrics payload now includes:
- workflowMetadata
- workflowMetrics
- workflowHealth
- workflowReadiness

## Compatibility

Workflow telemetry was integrated additively and preserves existing authentication, authorization, and messaging payload compatibility.
