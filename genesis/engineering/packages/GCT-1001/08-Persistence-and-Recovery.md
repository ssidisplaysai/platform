# 08 Persistence and Recovery

## Durable State
File-backed state in `data/contact/contact-state.v1.json` includes:
- contacts
- audits
- metrics
- duplicate backlog

## Recovery Behavior
Recovery is fail-closed via `PersistenceCoordinator` and `ContactRegistry.initialize` checks:
- schema enforcement (`1.0.0`)
- duplicate contact ID rejection
- duplicate method rejection
- invalid tenant/organization reference rejection
- cross-tenant affiliation rejection
- invalid merge-state guardrails

## Continuity Evidence
Validated behaviors include:
- restart rehydration of contacts
- audit continuity across restart
- metrics continuity across restart
- corruption rejection with explicit errors
