# 07 External Contract Map

Contract-first dependency map:

1. Identity Contract
- Role: required
- Purpose: actor identity context
- Direction: consumer-only

2. Authorization Contract
- Role: required
- Purpose: policy-based access decisions
- Direction: consumer-only

3. Organization Contract
- Role: required
- Purpose: organizational ownership and audience context
- Direction: consumer-only

4. Contact Contract
- Role: required
- Purpose: contributor/reviewer attribution
- Direction: consumer-only

5. Document Contract
- Role: required
- Purpose: document references and publication evidence links
- Direction: consumer-only

6. Workflow Contract
- Role: required
- Purpose: review and approval orchestration state integration
- Direction: consumer-only

7. Messaging Contract
- Role: required
- Purpose: domain event publication
- Direction: consumer-only

8. Notification Contract
- Role: required
- Purpose: audience notification dispatch integration
- Direction: consumer-only

9. Scheduling Contract
- Role: optional
- Purpose: timed review/publication windows
- Direction: consumer-only

10. Asset Contract
- Role: optional
- Purpose: referenced evidence/media linkage
- Direction: consumer-only

11. AI Contract
- Role: optional
- Purpose: recommendation and orchestration support
- Direction: consumer-only

12. Mission Control Contract
- Role: optional
- Purpose: observability exposure and monitoring compatibility
- Direction: observational integration only

Contract map controls:

- No direct implementation coupling.
- No ownership transfer through integration.
- No circular dependency allowance.
