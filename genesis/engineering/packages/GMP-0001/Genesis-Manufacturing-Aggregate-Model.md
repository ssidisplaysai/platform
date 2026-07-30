# Genesis Manufacturing Aggregate Model

## Aggregate Catalog
1. Work Order
2. Production Job
3. Operation
4. Routing
5. Work Center
6. Machine
7. Manufacturing Calendar
8. Production Schedule
9. Quality Inspection
10. Material Consumption
11. Labor Entry
12. Maintenance Event
13. Production Batch

## Aggregate Ownership Intent
1. Work Order
- Top-level manufacturing commitment and execution envelope.

2. Production Job
- Execution partition within a work order for a specific output segment.

3. Operation
- Atomic manufacturing step with measurable start, stop, and completion facts.

4. Routing
- Ordered operation definition with dependency and skill requirements.

5. Work Center
- Capacity and coordination boundary grouping machines and labor pools.

6. Machine
- Execution-capable resource with availability and utilization identity.

7. Manufacturing Calendar
- Time-capacity policy model for schedule feasibility.

8. Production Schedule
- Planned execution plan over jobs, operations, and resources.

9. Quality Inspection
- Immutable inspection and conformance record.

10. Material Consumption
- Traceable request/result record for material use.

11. Labor Entry
- Attributable human effort capture with duration and role context.

12. Maintenance Event
- Machine maintenance and availability-impact record.

13. Production Batch
- Physical production lot lineage and traceability container.

## Aggregate Boundaries
1. Commerce aggregate references are external identifiers only.
2. Inventory effects are represented as contract requests, not local stock mutation.
3. Finance and shipping effects remain external integration outcomes.
