# GCP-0002H Genesis Commercial Quotation System

## Objective
Implement the foundational quote aggregate with durable persistence, optimistic concurrency, revision timelines, pricing snapshots, lifecycle controls, scope-aware APIs, and bounded UI surfaces.

## Scope Included
- Quote aggregate model and repository.
- Immutable quote line pricing snapshots.
- Revision history and approval history.
- Quote lifecycle state transitions.
- Conversion request contract stub for downstream sales order orchestration.
- API routes for quote CRUD, lines, revisions, audit, and lifecycle transitions.
- UI routes for quote registry and detail-focused functional slices.
- Search, permissions, and navigation integration.

## Scope Excluded
- Downstream order creation and fulfillment implementation.
- Tax engine, freight engine, and external pricing integrations.
- Finalized commercial intelligence or analytics reporting.

## Delivery
Commit target: feat(gcqs): implement quote foundation.
