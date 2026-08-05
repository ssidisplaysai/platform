# 03 Consumer and Dependency Matrix

Consumer matrix:

| Consumer Platform | Product Provides | Product Consumes | Boundary |
| --- | --- | --- | --- |
| Inventory | Product IDs, variants, dimensions, lifecycle, stocking metadata | Inventory status only through approved query contracts | Product does not own quantity or warehouse state |
| Manufacturing | Product definitions, BOM definitions, configurations, versions | Manufacturing status only through approved observation contracts | Product does not execute production |
| Commerce | Products, variants, categories, pricing definitions, relationships | Commercial status only through approved contracts | Product does not own orders, carts, checkout, or fulfillment |
| CRM | Product references, families, metadata, commercial eligibility | Customer and opportunity references only | Product does not own accounts, contacts, or pipelines |
| Finance | Pricing definitions, costing references, lifecycle metadata | Financial classifications or posting status only through approved contracts | Product does not own ledger, invoicing, or payment |
| Analytics | Product dimensions, hierarchy, metadata, lifecycle | No operational ownership consumed | Analytics observes and measures only |
| Knowledge | Product context and references | Governed knowledge references | Knowledge owns semantics |
| Document | Product-document relationships | Document references and status | Document owns custody |
| Asset | Product-asset relationships | Asset references and status | Asset owns binary custody |
| Organization | Organization references | Organization identity and status | Organization owns organization records |
| Mission Control | Health, metrics, audit observations | No business behavior | Mission Control observes only |
| AI Orchestration | Product contracts and governed context | Recommendations or orchestration requests only | AI owns no Product state |

Dependency classification:

Required consumer-only dependencies:

1. Identity
2. Authorization
3. Organization
4. Asset
5. Document
6. Knowledge
7. Workflow
8. Messaging
9. Notification

Optional consumer-only dependencies:

1. Scheduling
2. AI Orchestration
3. Mission Control observability
4. Analytics projections

Forbidden dependencies:

1. Direct access to another platform persistence.
2. Implementation-internal imports across platform boundaries.
3. Local reimplementation of certified platform authority.
4. Circular ownership.
5. Product dependency on downstream Commerce, Inventory, Manufacturing, CRM, or Finance as authoritative prerequisites for Product identity.
