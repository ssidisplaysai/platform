# 01 Product Ownership Matrix

Product Platform purpose:

- The Product Platform is the canonical enterprise authority for product definition.
- The Product Platform operationalizes Product-domain behavior using governed contracts.
- The Product Platform consumes canonical truth and does not redefine canonical enterprise truth.

Canonical ownership matrix:

| Enterprise Concept | Canonical Owner | Downstream Consumers | Ownership Notes |
| --- | --- | --- | --- |
| Product | Product Platform | Inventory, Manufacturing, Commerce, CRM, Finance, Analytics | Canonical enterprise product record |
| Product Variant | Product Platform | Inventory, Commerce, Manufacturing | Size, color, model, SKU, or configuration variation |
| Product Family | Product Platform | Commerce, Manufacturing, Analytics | Product grouping and lineage |
| Product Category | Product Platform | Commerce, Analytics | Canonical product classification |
| Product Metadata | Product Platform | All authorized consumers | Canonical descriptive product metadata |
| Product Attribute Definition | Product Platform | Commerce, Manufacturing, Analytics | Defines valid product attributes |
| Product Option Definition | Product Platform | Commerce, Manufacturing | Defines selectable product options |
| Product Configuration | Product Platform | Commerce, Manufacturing | Valid product configuration definitions |
| Product Relationship | Product Platform | Commerce, Manufacturing, Analytics | Related, compatible, substitute, accessory, or bundled relationships |
| Product Lifecycle State | Product Platform | Inventory, Manufacturing, Commerce | Draft, active, suspended, retired, obsolete, or equivalent states |
| Product Version Definition | Product Platform | Manufacturing, Commerce, Analytics | Definition version, not inventory lot or manufacturing revision execution |
| Product Bundle Definition | Product Platform | Commerce, Manufacturing, Analytics | Definition of packaged product groupings |
| Product Kit Definition | Product Platform | Commerce, Manufacturing, Inventory | Definition of shippable or buildable kits |
| Bill of Material Definition | Product Platform | Manufacturing, Procurement, Analytics | Definition only; no production execution |
| Pricing Definition | Product Platform | Commerce, Finance, CRM | Definition only; no transaction settlement or accounting authority |
| Product Asset Reference | Product Platform | Commerce, CRM, Analytics | Reference only; binary custody remains with Asset Platform |
| Product Document Reference | Product Platform | Manufacturing, Commerce, Knowledge | Reference only; custody remains with Document Platform |
| Product Knowledge Reference | Product Platform | Commerce, Manufacturing, CRM | Reference only; semantic authority remains with Knowledge Platform |
| Product Organization Reference | Product Platform | All authorized consumers | Reference only; organization authority remains with Organization Platform |

Owned-concept governance rules:

1. Canonical owner: Product Platform for every concept in this matrix.
2. Business purpose: Product definition and governed reference composition only.
3. Authoritative state: Product-domain definition state only.
4. Lifecycle authority: Product lifecycle and definition evolution only.
5. Downstream consumers: Read/consume through versioned contracts.
6. Allowed references: External identifiers only; no foreign record duplication.
7. Prohibited expansion: No ownership transfer into Inventory, Manufacturing execution, Commerce transaction, CRM customer, or Finance accounting domains.
