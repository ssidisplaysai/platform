# Genesis Commerce Platform Organization and Site Scope Policy

## Scope Inputs
- Organization scope sources:
  - `x-gcp-organization-id` header
  - `organizationId` query parameter fallback
- Site scope sources:
  - `x-gcp-site-id` header
  - `siteId` query parameter fallback

## Required Rules
- Organization scope is mandatory for domain read APIs in Sites, Products, Inventory, Profiles, Customers, Contacts, and Addresses.
- Site scope is optional narrowing scope.
- When site scope is present:
  - collections MUST filter records to that site relationship.
  - details MUST return `404` if resource is outside scoped site relation.

## Domain Scope Semantics
| Domain | Organization Scope Rule | Site Scope Rule |
|---|---|---|
| Sites | site.organizationId must match scoped organization | if scoped site provided, site.siteId must match |
| Products | product.organizationId must match scoped organization | product primary/assigned site must match when scoped |
| Inventory stock | stock.organizationId must match scoped organization | stock.siteId must match when scoped |
| Inventory locations | location.organizationId must match scoped organization | location.siteId must match when scoped |
| Inventory movements | movement.organizationId must match scoped organization | at least one movement location must map to scoped site |
| Inventory reservations | reservation.organizationId must match scoped organization | reservation.siteId must match when scoped |
| Inventory counts | count.organizationId must match scoped organization | count location must map to scoped site |
| Profiles | profile.organizationId must match scoped organization | scoped site must exist in profile assignedSiteIds |
| Customers | customer.organizationId must match scoped organization | customer primary/associated site must include scoped site |
| Contacts | parent customer must satisfy customer scope rule | inherited from parent customer scope rule |
| Addresses | parent customer must satisfy customer scope rule | inherited from parent customer scope rule |

## Deferred Conditions
- Categories and Manufacturers currently use global fixture stores without organization keys.
- R1A enforces capability + required organization scope presence for taxonomy reads.
- Full per-organization taxonomy partitioning is deferred and out of scope for R1A.
