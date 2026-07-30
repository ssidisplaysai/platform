# Genesis Sales Order UI

## Implemented Routes
- `/orders` - Sales Order Registry
- `/orders/new` - Create Sales Order
- `/orders/{orderId}` - Sales Order Detail (Overview)
- `/orders/{orderId}/timeline` - Timeline
- `/orders/{orderId}/audit` - Audit Viewer
- `/orders/{orderId}/revisions` - Revision History
- `/orders/{orderId}/approval` - Approval Panel
- `/orders/{orderId}/search` - Search helper panel
- `/orders/from-quote/{quoteId}` - Create from Quote guidance view

## Registry View Features
- Search filter
- Status filter
- Quick links to detail/timeline/audit

## Detail View Features
- Quote lineage display
- Status/approval/revision/version badges
- Revision list
- Timeline list
- Audit + published event list

## UI Boundary
UI provides registry, detail, and governance visibility only. No downstream manufacturing/shipping/invoice execution UI is implemented.
