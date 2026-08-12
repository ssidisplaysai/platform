# Aggregation Model

Work Order: EHC-1001
Date: 2026-07-30

## Aggregation Outputs

- overall enterprise health state
- enterprise readiness status
- enterprise availability status
- per-application health status summary
- per-capability health summary
- compatibility summary counts

## Aggregation Semantics

Enterprise state precedence:
1. UNAVAILABLE
2. DEGRADED
3. WARNING
4. UNKNOWN
5. HEALTHY

Readiness aggregation:
- NOT_READY dominates
- UNKNOWN next
- READY otherwise

Liveness aggregation:
- NOT_LIVE dominates
- UNKNOWN next
- LIVE otherwise

## Persistence

Each aggregation result is stored as a timestamped health aggregation snapshot through repository abstraction.
