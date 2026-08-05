# 02 Explicit Non-Ownership Matrix

The Product Platform shall not own the following enterprise concepts:

| Enterprise Concept | Canonical Owner |
| --- | --- |
| Inventory Quantity | Inventory Platform |
| Available-to-Promise Quantity | Inventory Platform |
| Warehouse | Inventory Platform |
| Bin Location | Inventory Platform |
| Lot | Inventory Platform |
| Serial Number | Inventory Platform |
| Inventory Reservation | Inventory Platform |
| Inventory Movement | Inventory Platform |
| Manufacturing Work Order | Manufacturing Platform |
| Manufacturing Execution | Manufacturing Platform |
| Production Routing Execution | Manufacturing Platform |
| Production Schedule | Manufacturing Platform or Scheduling Platform according to approved boundary |
| Machine State | Manufacturing Platform |
| Labor Execution | Manufacturing Platform |
| Sales Order | Commerce Platform |
| Purchase Transaction | Commerce or Procurement authority according to approved platform model |
| Shopping Cart | Commerce Platform |
| Checkout | Commerce Platform |
| Fulfillment | Commerce Platform |
| Shipment | Commerce or Logistics authority according to approved platform model |
| Customer Account | CRM Platform |
| Opportunity | CRM Platform |
| Pipeline | CRM Platform |
| Contact | Contact Platform |
| Organization | Organization Platform |
| Invoice | Finance Platform |
| Payment | Finance Platform |
| General Ledger | Finance Platform |
| Tax Posting | Finance Platform |
| Revenue Recognition | Finance Platform |
| Binary Asset Storage | Asset Platform |
| Document Custody | Document Platform |
| Knowledge Semantics | Knowledge Platform |
| Authentication | Authentication Platform |
| Authorization Policy Ownership | Authorization Platform |
| Workflow Execution | Workflow Platform |
| Scheduling Execution | Scheduling Platform |
| Messaging Delivery | Messaging Platform |
| Notification Delivery | Notification Platform |
| AI Reasoning Authority | AI Orchestration Platform |
| Mission Control Behavior | Mission Control remains observational only |
| Canonical Business Knowledge Production | Genesis Compiler |
| Canonical Enterprise Knowledge Model | Business Genome |

Boundary intent:

- Product remains a canonical definition authority, not an execution authority for non-Product domains.
- No exception to this matrix is permitted without approved boundary governance.
