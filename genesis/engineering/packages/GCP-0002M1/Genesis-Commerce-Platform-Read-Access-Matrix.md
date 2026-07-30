# Genesis Commerce Platform Read Access Matrix

## Role Grants
| Domain | Capability | platform_admin | ops_manager | company_operator | analyst | viewer |
|---|---|---|---|---|---|---|
| Sites | sites:read | yes | yes | yes | yes | no |
| Products | products:read | yes | yes | yes | yes | no |
| Categories | products:read | yes | yes | yes | yes | no |
| Manufacturers | products:read | yes | yes | yes | yes | no |
| Inventory stock/locations/movements/reservations | inventory:read | yes | yes | yes | yes | no |
| Inventory counts internal | inventory:read_internal | yes | yes | yes | yes | no |
| Profiles | profiles:read | yes | yes | yes | yes | no |
| Profile readiness | profiles:evaluate_readiness | yes | yes | yes | yes | no |
| Customers | customers:read | yes | yes | yes | yes | no |
| Contacts | contacts:read | yes | yes | yes | yes | no |
| Addresses | addresses:read | yes | yes | yes | yes | no |

## Runtime API Conformance (R1A)
| Endpoint Family | Capability | No Auth | Viewer | Authorized Operator | Scope Rule |
|---|---|---|---|---|---|
| /api/sites (collection) | sites:read | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/sites/{id} (detail) | sites:read | 401 | 403 | 200/404 | out-of-scope returns 404 |
| /api/products (collection) | products:read | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/products/{id} (detail) | products:read | 401 | 403 | 200/404 | out-of-scope returns 404 |
| /api/inventory (collection) | inventory:read | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/inventory/locations | inventory:read | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/inventory/movements | inventory:read | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/inventory/reservations | inventory:read | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/inventory/counts | inventory:read_internal | 401 | 403 | 200 | requires organization scope; optional site scope filters collection |
| /api/categories | products:read | 401 | 403 | 200 | requires organization scope |
| /api/manufacturers | products:read | 401 | 403 | 200 | requires organization scope |
| /api/profiles | profiles:read | 401 | 403 | 200 | requires organization scope; optional site scope |
| /api/customers | customers:read | 401 | 403 | 200 | requires organization scope; optional site scope |

## Search / Navigation / Command Visibility
| Surface | Viewer | Analyst | Ops Manager |
|---|---|---|---|
| Navigation: Sites | hidden | visible | visible |
| Navigation: Products | hidden | visible | visible |
| Navigation: Inventory | hidden | visible | visible |
| Search entries requiring domain read capabilities | hidden | visible | visible |
| Command palette open-domain actions | hidden | mixed (based on capability) | visible |
