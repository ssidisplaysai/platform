# GBA-0002 Production Scheduling

## Capability
Production scheduling is modeled as queue and machine assignments with shift sequencing, planned windows, and bottleneck risk flags.

## Data Model
- `GbaOperationsProductionSchedule`
- Deterministic lineage per schedule row
- Indexed by workspace and sequence for operational retrieval

## Runtime Notes
- Baseline schedule data is seeded if the workspace has no records.
- Schedule records feed dashboard throughput and manufacturing health views.
- Scheduling changes are reflected in timeline events.
