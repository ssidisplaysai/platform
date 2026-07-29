# Genesis Commerce Platform Domain Dependency Graph

## Scope
Bounded GCP foundation domains audited from GCP-0002B through GCP-0002G.

## Dependency Classification
- Required: hard dependency for record validity or operation.
- Optional: link may be absent without invalidating base record.
- Derived: value computed from other records or projections.
- Prohibited: dependency is intentionally disallowed by boundary.
- Deferred: required for future transactional modules, not implemented in bounded foundation.

## Graph (Adjacency)
- Organization
  - Required -> Site.organizationId
  - Required -> Product.organizationId
  - Required -> InventoryLocation.organizationId
  - Required -> IntegrationProfile.organizationId
  - Required -> Customer.organizationId
  - Prohibited -> Genesis canonical authority ownership
- Site
  - Required -> Organization
  - Optional -> Integration profile references
  - Derived -> Site readiness evaluation
  - Deferred -> Durable publication execution state
- Product
  - Required -> Organization
  - Optional -> Manufacturer
  - Optional -> Category (at create time enforced by readiness, not strict creation blocker)
  - Optional -> Primary Site assignment
  - Optional -> Integration profile references (SEO/prompt/image references)
  - Derived -> Product readiness evaluation
  - Deferred -> Quote line/item commercial state
- Category
  - Required -> Organization
  - Optional -> Parent Category
  - Optional -> Site assignments
- Manufacturer
  - Required -> Organization
  - Optional -> Business Genome reference (opaque)
- Product-Site Assignment
  - Required -> Product
  - Required -> Site
  - Optional -> Profile references
  - Derived -> Publication compatibility signals
- Inventory Location
  - Required -> Organization
  - Optional -> Site
  - Optional -> Parent Location
- Stock Record
  - Required -> Organization
  - Required -> Product
  - Required -> Inventory Location
  - Derived -> Available quantity, stock status
- Inventory Movement
  - Required -> Organization
  - Required -> Product
  - Optional -> Source Location
  - Optional -> Destination Location
  - Optional -> Reservation reference
  - Derived -> Stock mutations and activity records
- Reservation
  - Required -> Organization
  - Required -> Product
  - Required -> Inventory Location
  - Optional -> Site
  - Optional -> External reference ids
- Integration Profile
  - Required -> Organization
  - Optional -> Site assignment list
  - Derived -> Readiness output
- Profile Assignment
  - Required -> Organization
  - Required -> Profile
  - Required -> Target (site/product/category/page_template/blog_template/media)
  - Optional -> Site context for inherited targets
- Customer Account
  - Required -> Organization
  - Optional -> Primary Site
  - Optional -> Associated Sites
  - Optional -> Primary Contact
  - Optional -> Billing/Shipping Address
  - Derived -> Readiness and duplicate candidates
- Contact
  - Required -> Customer
  - Required -> Organization (copied from customer)
  - Derived -> Primary-contact selection semantics
- Address
  - Required -> Customer
  - Required -> Organization (copied from customer)
  - Optional -> Site
  - Derived -> Customer default billing/shipping linkage

## Cycle Analysis
- Evaluated cycles among Organization, Site, Product, Inventory, Profile, and Customer families.
- No unresolved hard dependency cycles found.
- Observed references are directional and evaluators/readiness functions compute derived outputs without introducing mandatory cyclic constraints.

## Prohibited/Deferred Boundaries Confirmed
- Prohibited: direct mutation of Business Genome canonical authority.
- Prohibited: workflow runtime execution, publishing runtime execution, AI execution, marketing kernel execution.
- Deferred: transactional aggregate dependencies (quote/order/invoice/payment) and durable persistence/transaction management.
