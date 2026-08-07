# 12 Routing and Operation Architecture

Runtime mechanics:
- routing instantiation captures Product design-time routing reference and freezes an execution copy
- routing-step sequencing follows explicit predecessor/successor relationships
- dependency graph validation rejects structural cycles
- conditional steps require explicit predicates and approval context
- bounded rework edges are allowed only by explicit policy and traceable re-entry points
- operation eligibility is derived from predecessor state, resource readiness, and material readiness
- operation start, pause, resume, completion, and skip all require expected-version checks
- successor activation occurs only after completed predecessor conditions are satisfied
- route completion requires all required operations and closure conditions to be satisfied

Cycle policy:
- arbitrary routing graph cycles are prohibited
- allowed rework loops are structurally bounded, explicitly labeled, and traceable
