# Health Repository Documentation

Work Order: EHC-1001
Date: 2026-07-30

## Repository Interface

EnterpriseHealthRepository supports:
- createRecord
- updateCurrent
- retrieveCurrent
- retrieveAllCurrent
- retrieveHistory
- appendEvent
- retrieveEvents
- saveSnapshot
- retrieveLatestSnapshot
- saveAggregation
- retrieveLatestAggregation

## Current Adapter

In-memory adapter is implemented in:
- src/platform/ehc/repository.ts

## Replaceability

Service layer uses repository abstraction only.

Future persistence adapters can replace in-memory storage without service contract changes.
