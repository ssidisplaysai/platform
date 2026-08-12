# Health Data Model

Work Order: EHC-1001
Date: 2026-07-30

## Core Objects

- EnterpriseHealthRecord
- ApplicationHealthStatus
- ReadinessStatus
- LivenessStatus
- CapabilityStatus
- CapabilityAdvertisement
- CompatibilityAssessment
- HealthSnapshot
- HealthHistory
- HealthAggregation
- HealthEvent
- HealthReference

## State Domains

Enterprise health state:
- HEALTHY
- WARNING
- DEGRADED
- UNAVAILABLE
- UNKNOWN

Readiness:
- READY
- NOT_READY
- UNKNOWN

Liveness:
- LIVE
- NOT_LIVE
- UNKNOWN

Capability availability:
- AVAILABLE
- UNAVAILABLE
- UNKNOWN

## Inventory Constraint

Health records are keyed by applicationId received from certified EAR interfaces.

No standalone EHC application identity model is introduced.
