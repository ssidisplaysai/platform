# 11 Work Order Execution Architecture

Deterministic execution sequence:
1. validate command
2. validate tenant
3. validate Product references
4. validate Product/BOM execution baseline
5. validate expected Work Order version
6. validate routing readiness
7. validate required material readiness
8. validate Work Center and resource readiness
9. evaluate lifecycle invariants
10. mutate proposed Work Order state
11. update WIP state
12. create execution audit evidence
13. persist atomically
14. update metrics and projections
15. publish observation

Distinct flows:
- release: freezes execution baseline and readiness gates
- start: opens execution and WIP flow
- pause: suspends execution without losing traceability
- resume: restores execution from paused state
- hold: blocks execution pending corrective action
- cancel: ends execution with compensating/final audit rules
- complete: records completion facts and final quantities
- close: finalizes order and transitions to terminal closure rules

Execution rule:
- release and start must not bypass material, routing, or resource readiness checks
