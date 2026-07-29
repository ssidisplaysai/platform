# Genesis Commerce Platform Authorization Policy

## Decision Record
- Package: GCP-0002M1-R1A
- Decision: enforce declared capability model as runtime source of truth.
- Viewer policy decision: viewer SHALL NOT read Sites, Products, Inventory, Categories, Manufacturers, Profiles, Customers, Contacts, or Addresses APIs.
- Defect classification: prior viewer access to selected collection reads was an implementation defect, not approved product policy.

## Capability Canonical Form
- Current canonical capability format in this repository is namespace-style `domain:action`.
- Examples: `sites:read`, `products:read`, `inventory:read`, `profiles:read`, `customers:read`, `contacts:read`, `addresses:read`.
- Compatibility aliases: none introduced in this package.
- Naming migration to dot form is deferred to future non-functional policy cleanup and is out of scope for R1A.

## Authentication Model
- Auth header: `x-gcp-roles`.
- Authenticated request: header present with at least one valid role.
- Unauthenticated request: missing or invalid role header.
- Authorization behavior:
  - `401 Unauthorized` for unauthenticated requests.
  - `403 Forbidden` for authenticated requests lacking required capability and/or required scope.

## Read Policy By Domain
| Domain | Required Capability | Viewer Access | Organization Scope | Site Scope | Internal Data Rule |
|---|---|---|---|---|---|
| Commerce foundation shell | workspace:view | allowed for shell only | n/a (UI shell context) | n/a | no sensitive domain records exposed by shell |
| Organizations (companies route context) | workspace:view | allowed in shell context | company context filtered by repository context | n/a | identifiers only |
| Sites | sites:read | denied | required | optional site narrowing | no secret fields |
| Products | products:read | denied | required | optional site narrowing via assignment/primary site | internal fields require existing product internal capabilities |
| Categories | products:read | denied | required request scope | n/a (taxonomy currently global fixtures) | no sensitive fields |
| Manufacturers | products:read | denied | required request scope | n/a (taxonomy currently global fixtures) | no sensitive fields |
| Inventory (stock/locations/movements/reservations/counts/availability) | inventory:read or inventory:read_internal | denied | required | optional site narrowing via location/site relationships | internal count data requires `inventory:read_internal` |
| Integration profiles | profiles:read (readiness: profiles:evaluate_readiness) | denied | required | optional site narrowing via assigned sites | references only, no raw credentials |
| Customers | customers:read | denied | required | optional site narrowing via customer site association | no prohibited sensitive fields |
| Contacts | contacts:read | denied | required through parent customer | optional via parent customer site scope | contact details remain capability-protected |
| Addresses | addresses:read | denied | required through parent customer | optional via parent customer site scope | address details remain capability-protected |

## Search, Navigation, and Command Policy
- Enterprise Search results are filtered by `requiredPermissions` on search items.
- Navigation visibility is filtered by `requiredPermissions` on navigation entries.
- Command palette visibility is filtered by `requiredPermissions` on command entries.
- UI visibility is supplementary; API authorization remains the authority for data access.

## Unauthorized API Behavior
- Collection reads: return `401` when unauthenticated, `403` when unauthorized.
- Detail reads: return `404` when resource is outside authorized scope to avoid existence disclosure.
- Malformed input: return `400` where existing conventions already define validation failures.
