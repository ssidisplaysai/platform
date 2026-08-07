# 04 Command and Query Surface

## Command Surface

| Command | Authority | Identifiers | Expected Versions | Idempotency Key | Correlation ID | Reference Validation Sequence | Invariant Checks | Product Dependencies | Inventory Dependencies | Atomicity Boundary | Audit Evidence | Conceptual Events | Fail-Closed Behavior |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CreateManufacturingWorkOrder | Manufacturing | tenant, workOrderId, workOrderNumber | none on create | required | required | product, variant if applicable, version, BOM, external demand | tenant, uniqueness, quantity defaults | product/variant/version/BOM contract | none direct | work order aggregate | creation audit, snapshot | ManufacturingWorkOrderCreated | reject invalid product/BOM or duplicate key |
| PlanManufacturingWorkOrder | Manufacturing | workOrderId | expected current version | required | required | product/BOM baseline, routing readiness | planned qty coherence, schedule validity | product version/BOM snapshot | none direct | work order aggregate | planning audit | ManufacturingWorkOrderPlanned | reject stale version or invalid baseline |
| ReleaseManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | product refs, routing readiness, material readiness, resource readiness | lifecycle legality, requirement freeze | product version/BOM snapshot | inventory readiness refs if required | work order aggregate | release audit | ManufacturingWorkOrderReleased | reject if readiness fails |
| StartManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | tenant, release state, routing readiness, material readiness, resource readiness | lifecycle and WIP invariants | product baseline snapshot | inventory issue/availability readiness | work order aggregate | start audit | ManufacturingWorkOrderStarted | reject if not ready |
| PauseManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | tenant, current status | pause legality and WIP coherence | product baseline if needed | none direct | work order aggregate | pause audit | ManufacturingWorkOrderPaused | reject illegal transition |
| ResumeManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | tenant, current status | resume legality and WIP coherence | none direct | none direct | work order aggregate | resume audit | ManufacturingWorkOrderResumed | reject illegal transition |
| PlaceManufacturingWorkOrderOnHold | Manufacturing | workOrderId, hold reference | expected version | required | required | hold reference validation | hold legality and downstream block rules | none direct | none direct | work order aggregate | hold audit | QualityHoldApplied | reject invalid hold |
| ReleaseManufacturingWorkOrderHold | Manufacturing | workOrderId, hold reference | expected version | required | required | hold reference validation | hold release legality | none direct | none direct | work order aggregate | hold release audit | QualityHoldReleased | reject invalid hold release |
| CancelManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | tenant, status | cancellation rules and compensating facts | product snapshot if required | inventory reversal refs if required | work order aggregate | cancel audit | ManufacturingWorkOrderCancelled | reject if terminal or unauthorized |
| CompleteManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | all required output and consumption refs, routing closure | quantity coherence, downstream completeness | product/BOM snapshot for trace | inventory receipt/issue refs if applicable | work order aggregate | complete audit | ManufacturingWorkOrderCompleted | reject if incomplete or stale |
| CloseManufacturingWorkOrder | Manufacturing | workOrderId | expected version | required | required | completion and trace validation | terminal state legality | none direct | none direct | work order aggregate | close audit | ManufacturingWorkOrderClosed | reject if not complete |
| CreateProductionRun | Manufacturing | runId, runCode, workOrderId | none on create | required | required | work order validity, routing snapshot | run quantity and uniqueness | product routing refs | inventory readiness refs if required | run aggregate | creation audit | ProductionRunCreated | reject invalid work order |
| StartProductionRun | Manufacturing | runId | expected version | required | required | routing readiness, resource readiness | run legality, batch coherence | product routing ref snapshot | inventory readiness refs | run aggregate | start audit | ProductionRunStarted | reject if prerequisites fail |
| CompleteProductionRun | Manufacturing | runId | expected version | required | required | run outputs, trace closure | run closure invariants | product snapshot | inventory receipt refs if needed | run aggregate | close audit | ProductionRunCompleted | reject if incomplete |
| CreateProductionBatch | Manufacturing | batchId, batchCode, runId | none on create | required | required | run and work-order validation | batch uniqueness and coherence | product/BOM snapshot | lot/serial refs if needed | batch aggregate | creation audit | ProductionBatchCreated | reject invalid run |
| StartOperation | Manufacturing | operationExecutionId, routingStepId | expected version | required | required | routing step, work-order, resource, material, product validation | operation prerequisites, sequencing, resource capacity | product routing/process snapshot | inventory readiness refs if operation needs material | operation aggregate | start audit | OperationStarted | reject if prerequisites fail |
| PauseOperation | Manufacturing | operationExecutionId | expected version | required | required | tenant, current operation status | pause legality | none direct | none direct | operation aggregate | pause audit | OperationPaused | reject illegal transition |
| ResumeOperation | Manufacturing | operationExecutionId | expected version | required | required | tenant, current operation status | resume legality | none direct | none direct | operation aggregate | resume audit | OperationResumed | reject illegal transition |
| CompleteOperation | Manufacturing | operationExecutionId | expected version | required | required | output, consumption, trace readiness | completion prerequisites and quantity coherence | product baseline snapshot | inventory refs if outputs/consumption require them | operation aggregate | completion audit | OperationCompleted | reject stale or incomplete completion |
| SkipOperation | Manufacturing | operationExecutionId, reason | expected version | required | required | routing skip policy and authority | skip policy, rework gating | product routing ref | none direct | routing/operation aggregate | skip audit | OperationSkipped | reject if step not skippable |
| RequestRework | Manufacturing | workOrderId, source output ref | expected version | required | required | output, routing, product validation | rework policy and loop bounds | product version/BOM snapshot | inventory refs if material required | rework aggregate | rework request audit | ReworkRequested | reject if unauthorized loop |
| CompleteRework | Manufacturing | reworkId | expected version | required | required | source trace, target operation, output | rework closure coherence | product baseline snapshot | inventory refs if affected | rework aggregate | completion audit | ReworkCompleted | reject if trace broken |
| CreateMaterialRequirement | Manufacturing | requirementId, workOrderId | none on create | required | required | product/BOM validation and work-order context | requirement quantity coherence | BOM source lineage | inventory item refs for mapped materials | requirement aggregate | creation audit | MaterialRequirementCreated | reject invalid BOM or work order |
| RequestMaterialReservation | Manufacturing | requirementId | expected version | required | required | requirement, item, availability inquiry | quantity and policy checks | product baseline snapshot | availability/reservation contract | requirement/issue boundary | request audit | MaterialReservationRequested | reject on invalid availability context |
| RequestMaterialAllocation | Manufacturing | requirementId | expected version | required | required | reservation/availability, item validation | allocation coherence | product snapshot | allocation contract | requirement/issue boundary | request audit | MaterialAllocationRequested | reject if reservation absent where required |
| RequestMaterialIssue | Manufacturing | requirementId | expected version | required | required | requirement, item, reservation/allocation, availability | issue policy, quantity, lot/serial rules | product snapshot | issue/movement contract | issue boundary | request audit | MaterialIssueRequested | reject if inventory request fails |
| RecordMaterialConsumption | Manufacturing | requirementId, operationExecutionId | expected version | required | required | approved issue context, movement reference, lot/serial if needed | consumption coherence, variance policy | product baseline snapshot | movement lookup/reference | consumption aggregate | consumption audit | MaterialConsumed | reject if issue context invalid |
| RecordMaterialReturn | Manufacturing | requirementId | expected version | required | required | return policy, movement reference if needed | return coherence | product snapshot | return-to-stock contract | consumption/requirement boundary | return audit | MaterialReturned | reject invalid or stale return |
| RecordProductionOutput | Manufacturing | outputId, workOrderId | expected version | required | required | work order, operation, product reference, receipt intent | output quantity coherence | product version/BOM snapshot | finished-goods receipt contract | output aggregate | output audit | ProductionOutputRecorded | reject if inventory acceptance fails |
| RecordScrap | Manufacturing | scrapId, workOrderId | expected version | required | required | output or operation, reason, policy refs | scrap coherence and correction policy | product snapshot if required | write-off contract if approved | scrap aggregate | scrap audit | ScrapRecorded | reject invalid reason or stale state |
| RecordYield | Manufacturing | yieldId, workOrderId | expected version | required | required | output/scrap/rework inputs | denominator-zero policy, formula version | product unit context | none direct | yield aggregate or projection | yield audit where canonical | YieldRecorded | reject invalid source facts |
| AssignWorkCenter | Manufacturing | workOrderId or operationExecutionId, workCenterId | expected version | required | required | work-center validity, capacity, tenant | capacity and assignment rules | none direct | none direct | assignment boundary | assignment audit | WorkCenterAssigned | reject capacity conflict |
| AssignMachine | Manufacturing | operationExecutionId, assetId | expected version | required | required | asset validity, capacity, availability | concurrency and maintenance hold checks | asset reference snapshot | none direct | assignment boundary | assignment audit | MachineAssigned | reject invalid asset or conflict |
| AssignTool | Manufacturing | operationExecutionId, assetId | expected version | required | required | tool validity, calibration, availability | eligibility and concurrency checks | asset reference snapshot | none direct | assignment boundary | assignment audit | ToolAssigned | reject invalid tool or conflict |
| AssignLabor | Manufacturing | operationExecutionId, personRef | expected version | required | required | identity/organization validation | role and shift rules | identity reference snapshot | none direct | assignment boundary | assignment audit | LaborAssigned | reject invalid identity or conflict |
| RecordDowntimeStart | Manufacturing | downtimeId, workOrderId | none or expected version on target | required | required | work center, machine, operation, reason | overlap and category rules | none direct | none direct | downtime aggregate | downtime audit | DowntimeStarted | reject invalid context |
| RecordDowntimeEnd | Manufacturing | downtimeId | expected version | required | required | downtime existence and matching context | duration and closure rules | none direct | none direct | downtime aggregate | downtime close audit | DowntimeEnded | reject if no open downtime |
| ApplyQualityHoldReference | Manufacturing | holdId, target ref | expected version | required | required | hold validity and target validation | hold application rules | none direct | none direct | hold/reference boundary | hold audit | QualityHoldApplied | reject invalid hold ref |
| ReleaseQualityHoldReference | Manufacturing | holdId, target ref | expected version | required | required | hold validity | release rules | none direct | none direct | hold/reference boundary | hold release audit | QualityHoldReleased | reject invalid hold release |

## Query Surface

| Query | Deterministic | Read-Only | Tenant Isolation | Facts Exposed |
|---|---|---|---|---|
| GetManufacturingWorkOrder | yes | yes | yes | work order, state, refs, audit snapshots |
| ListManufacturingWorkOrders | yes | yes | yes | filtered work order summaries |
| ListWorkOrdersByProduct | yes | yes | yes | work orders by product context |
| ListWorkOrdersByStatus | yes | yes | yes | work-order state summaries |
| GetProductionRun | yes | yes | yes | run facts and summaries |
| ListProductionRuns | yes | yes | yes | filtered run summaries |
| GetProductionBatch | yes | yes | yes | batch facts and trace links |
| GetExecutionRouting | yes | yes | yes | routing instantiation and steps |
| GetOperationExecution | yes | yes | yes | operation state and execution facts |
| ListOperationsByWorkOrder | yes | yes | yes | operations for work order |
| GetMaterialRequirement | yes | yes | yes | requirement baseline and variance |
| ListMaterialRequirementsByWorkOrder | yes | yes | yes | material requirements by order |
| GetMaterialConsumption | yes | yes | yes | consumption facts |
| ListMaterialConsumptionByWorkOrder | yes | yes | yes | consumption by order |
| GetProductionOutput | yes | yes | yes | output facts |
| ListProductionOutputsByWorkOrder | yes | yes | yes | outputs by order |
| GetYield | yes | yes | yes | yield fact or derived projection |
| GetScrap | yes | yes | yes | scrap facts |
| GetRework | yes | yes | yes | rework facts |
| GetWorkCenter | yes | yes | yes | work-center state |
| ListWorkCenters | yes | yes | yes | work-center summaries |
| GetProductionCell | yes | yes | yes | cell state |
| GetMachineAssignment | yes | yes | yes | machine assignment facts |
| GetLaborAssignment | yes | yes | yes | labor assignment facts |
| GetWipState | yes | yes | yes | WIP state |
| GetDowntime | yes | yes | yes | downtime facts |
| GetProductionTrace | yes | yes | yes | immutable trace graph slice |
| GetManufacturingHealth | yes | yes | yes | runtime and dependency health |
| GetManufacturingMetrics | yes | yes | yes | derived operational metrics |

Query rules:
- queries are read-only and deterministic
- queries expose Manufacturing-owned facts only
- queries preserve tenant isolation
- queries do not become analytics authority; they only expose platform-owned read models
