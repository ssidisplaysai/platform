# 05 Work Order and Execution Ownership

## Manufacturing Work Order Authority

Manufacturing is canonical owner of Manufacturing Work Orders.

Manufacturing Work Order owned fields include:
- work-order identity
- Product and Product Variant references
- Product version and BOM reference
- requested quantity
- planned quantity
- completed quantity
- rejected quantity
- scrap quantity
- status
- routing
- work-center assignment
- production dates
- actual execution state
- correlation identifiers
- audit metadata

## Explicit Separation

A Manufacturing Work Order is not a Commerce order and must not absorb commerce transaction semantics.

## Execution Lifecycle Authority

Manufacturing owns execution lifecycle states for work initiation, in-progress execution, pause/resume, completion, rejection, scrap, rework, and closure outcomes.
