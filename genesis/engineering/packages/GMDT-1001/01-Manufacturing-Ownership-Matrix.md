# 01 Manufacturing Ownership Matrix

## Canonical Manufacturing Ownership

| Concept | Canonical Owner | Notes |
|---|---|---|
| Manufacturing Work Order | Manufacturing | Canonical execution authority record for production execution. |
| Production Order | Manufacturing | Execution order in Manufacturing scope, not a Commerce order. |
| Production Run | Manufacturing | Runtime execution grouping for manufacturing activity. |
| Production Batch | Manufacturing | Execution batch identity and state within production context. |
| Manufacturing Job | Manufacturing | Operational execution unit under a work order or run. |
| Routing (execution) | Manufacturing | Instantiated execution route for actual production. |
| Routing Step | Manufacturing | Step-level execution state and transition authority. |
| Operation | Manufacturing | Production operation instance and execution result. |
| Operation Sequence | Manufacturing | Ordered execution progression for run-time work. |
| Work Center (operational) | Manufacturing | Operational manufacturing resource grouping and status. |
| Production Cell | Manufacturing | Execution-level production cell assignment and readiness state. |
| Machine Assignment | Manufacturing | Assignment of asset references to execution. |
| Labor Assignment | Manufacturing | Assignment of operator references to execution. |
| Shift Execution Reference | Manufacturing | Shift reference linkage and execution facts. |
| Material Requirement | Manufacturing | Derived requirement from approved Product BOM definitions. |
| Material Issue Request | Manufacturing | Request intent to Inventory for material issue actions. |
| Material Consumption Record | Manufacturing | Actual consumption fact for production execution. |
| Production Output Record | Manufacturing | Completion/reject/scrap/rework/yield fact authority. |
| Scrap Record | Manufacturing | Canonical production scrap fact. |
| Rework Record | Manufacturing | Canonical production rework fact. |
| Yield Record | Manufacturing | Canonical production yield fact. |
| Downtime Record | Manufacturing | Canonical manufacturing downtime fact. |
| Production Status | Manufacturing | Work execution lifecycle state authority. |
| Work-In-Progress State | Manufacturing | In-process execution status authority. |
| Production Schedule Execution State | Manufacturing | Manufacturing schedule semantic state authority. |
| Quality Hold Reference | Manufacturing | Hold state in production execution scope with bounded references. |
| Manufacturing Instruction Reference | Manufacturing | Execution reference linkage to Document authority artifacts. |
| Production Traceability | Manufacturing | Execution lineage of inputs, operations, and outputs. |
| Manufacturing Metadata | Manufacturing | Execution metadata owned by Manufacturing lifecycle. |
| Manufacturing Relationships | Manufacturing | Internal execution relationship authority. |
| Manufacturing Lifecycle | Manufacturing | Canonical lifecycle for manufacturing execution entities. |

## Boundary Rule

Manufacturing owns production execution truth. Product owns design definitions. Inventory owns stock truth. Shared owns reusable infrastructure only.
