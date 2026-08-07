# 10 State Model and Projections

## Canonical Manufacturing State

May include:
- Work Orders
- Production Runs
- Production Batches
- instantiated routes
- operation executions
- material requirements
- issue requests
- consumption records
- output records
- scrap and rework facts
- Work Centers
- Production Cells
- assignments
- WIP
- downtime
- trace records
- idempotency records
- versions
- reference metadata

## Derived Projections

May include:
- throughput
- work-order progress
- operation progress
- yield
- scrap rate
- downtime totals
- WIP summaries
- material variance
- work-center utilization
- runtime health
- metrics

Projection rules:
- projections are recomputable
- projections do not own canonical truth
- projections must rebuild from canonical state/history
- projection lag does not change canonical state
