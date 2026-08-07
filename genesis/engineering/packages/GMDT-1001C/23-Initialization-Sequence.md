# 23 Initialization Sequence

Deterministic startup order:
1. validate runtime options
2. initialize Shared runtime mechanics
3. register Manufacturing providers
4. register Product integration validators
5. register Inventory integration validators and ports
6. initialize persistence
7. load persisted state
8. validate schema
9. validate Manufacturing structural invariants
10. validate routing graph
11. validate Work Order and operation consistency
12. validate material-requirement consistency
13. validate traceability
14. validate idempotency and version state
15. execute approved foreign-reference recovery validation
16. rebuild projections
17. recompute metrics
18. establish health
19. register observation publisher
20. mark ready

Blocking failures prevent READY.
