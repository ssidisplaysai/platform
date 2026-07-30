# Genesis Work Order UI Surfaces

## Delivered Surfaces
- Work Order Registry: /work-orders
- Work Order Detail: /work-orders/{id}
- Create Work Order: /work-orders/new
- Create From Sales Order: /work-orders/from-order/{orderId}
- Timeline: /work-orders/{id}/timeline
- Audit: /work-orders/{id}/audit
- Revision History: /work-orders/{id}/revisions
- Search Surface: /work-orders/search and /work-orders/{id}/search
- Manufacturing Summary: /work-orders/summary

## UX Characteristics
- Foundation shell consistency with existing commerce/manufacturing modules
- Direct navigation to timeline, audit, revisions, and lineage
- Search and filtering by status and free text

## Boundary Note
UI intentionally excludes execution-grade production controls, scheduling tools, inventory operations, and quality workflows.
