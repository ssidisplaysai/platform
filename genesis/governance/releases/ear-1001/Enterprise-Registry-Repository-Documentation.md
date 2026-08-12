# Enterprise Registry Repository Documentation

Work Order: EAR-1001
Date: 2026-07-30

## Repository Contract

EnterpriseRegistryRepository methods:
- create(registration)
- read(applicationId)
- update(applicationId, registration)
- deactivate(applicationId, deactivatedRegistration)
- list()
- search(query)

## Current Implementation

In-memory repository implementation:
- location: src/platform/ear/repository.ts
- storage: Map keyed by applicationId
- behavior: immutable-style clone on read/write boundaries

## Search Semantics

Supports filtering by:
- lifecycleState
- capability
- ownerOrganization
- q free text
- limit

## Persistence Replaceability

The service layer depends only on EnterpriseRegistryRepository abstraction.

Future database adapters may implement the same contract without changing service behavior.
