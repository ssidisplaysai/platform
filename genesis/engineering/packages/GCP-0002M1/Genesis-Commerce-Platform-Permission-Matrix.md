# Genesis Commerce Platform Permission Matrix

## Role to Capability Summary
| Capability Group | platform_admin | ops_manager | company_operator | analyst | viewer |
|---|---|---|---|---|---|
| Workspace and context | full | context + view | context + view | context + view | limited view |
| Sites | full | full | read/update/test/health | read/health/audit | none |
| Products/Catalog | full | full | read/create/update/spec/site-assign/readiness/internal | read/readiness/internal/audit | none |
| Inventory | full | full | read/internal + movement/reservation/count flows | read/internal/audit | none |
| Profiles | full | full | read/update/validate/readiness/assign | read/readiness | none |
| Customers/Contacts/Addresses | full | full | read/create/update/readiness/duplicate + contact/address R/W | read + readiness/duplicate/activity + contact/address read | none |
| Settings/Notifications/Audit | full | settings view + notif manage + audit view | settings view + notif view | settings view + notif view + audit view | settings/notifications view |
| Search/Command palette | full | full | full | search only | none |

## API Authorization Verification (Sample)
| Endpoint | Method | Declared Capability | Observed Viewer Result | Expected | Status |
|---|---|---|---|---|---|
| /api/sites | GET | sites:read | 200 | 403 | FAIL |
| /api/products | GET | products:read | 200 | 403 | FAIL |
| /api/inventory | GET | inventory:read | 200 | 403 | FAIL |
| /api/profiles | GET | profiles:read | 403 | 403 | PASS |
| /api/customers | GET | customers:read | 403 | 403 | PASS |
| /api/customers/{id}/readiness | GET | customers:evaluate_readiness | 403 | 403 | PASS |
| /api/customers/{id}/readiness | GET (analyst) | customers:evaluate_readiness | 200 | 200 | PASS |
| /api/inventory/movements | POST | inventory:create_movement | 403 | 403 | PASS |

## Findings
- Capability naming is deterministic and consistently namespaced.
- Server-side enforcement is strong on most write and evaluation endpoints.
- Read collection APIs for sites/products/inventory are inconsistent with permission model.
