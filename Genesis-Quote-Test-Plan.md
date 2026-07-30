# Genesis Quote Test Plan

## Foundation Tests
- quote create/list behaviors.
- line add/update/remove with totals recomputation.
- lifecycle transition validation and invalid transition rejection.
- revision creation and revision history integrity.
- conversion contract precondition and request behavior.
- audit event emission.

## API Tests
- auth enforcement for read/write actions.
- organization/site scope restrictions.
- quote detail and draft patch behavior.
- line routes and revision routes.
- lifecycle transition routes including conversion.
- audit visibility and search route behavior.

## Validation Gates
- Run focused quote test files.
- Run scoped lint for touched quote modules and routes.
- Preserve baseline debt outside quote scope.
