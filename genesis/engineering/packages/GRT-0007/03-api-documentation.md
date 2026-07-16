# GRT-0007 API Documentation

## RuntimeProcess API

File: src/runtime/workflows/RuntimeProcess.ts
- constructor(record: RuntimeProcessRecord)
- snapshot(): RuntimeProcessRecord

Purpose:
- Parent runtime orchestration abstraction for process types.

## RuntimeWorkflow API

File: src/runtime/workflows/RuntimeWorkflow.ts
- constructor(workflowRecord: RuntimeWorkflowRecord)
- snapshot(): RuntimeWorkflowRecord

Purpose:
- Immutable runtime workflow definition artifact.

## RuntimeWorkflowInstance API

File: src/runtime/workflows/RuntimeWorkflowInstance.ts
- constructor(record: RuntimeWorkflowInstanceRecord)
- snapshot(): RuntimeWorkflowInstanceRecord

Purpose:
- Immutable workflow-instance execution state artifact.

## RuntimeActivityGraph API

File: src/runtime/workflows/RuntimeActivityGraph.ts
- constructor(workflow: RuntimeWorkflowRecord)
- snapshot(): RuntimeActivityGraphSnapshot
- activity(activityId: string): RuntimeActivityRecord
- transitionsFrom(activityId: string): readonly RuntimeTransitionRecord[]
- inbound(activityId: string): readonly RuntimeActivityGraphEdge[]
- eligibleActivities(instance: RuntimeWorkflowInstanceRecord): readonly RuntimeActivityRecord[]

Purpose:
- Graph validation, canonical ordering, and deterministic activity-eligibility/traversal logic.

## RuntimeExecutionIntent API

File: src/runtime/workflows/RuntimeExecutionIntent.ts
- constructor(record: RuntimeExecutionIntentRecord)
- static identityFor(record: Omit<RuntimeExecutionIntentRecord, "intentId">, ordinal: number): string
- snapshot(): RuntimeExecutionIntentRecord

Purpose:
- Immutable deterministic activity execution intent consumed by scheduler integration path.

## RuntimeTransitionEngine API

File: src/runtime/workflows/RuntimeTransitionEngine.ts
- orderTransitions(transitions: readonly RuntimeTransitionRecord[]): readonly RuntimeTransitionRecord[]
- evaluate(graph, activityId, transitions, observation?): RuntimeTransitionApplication

Purpose:
- Deterministic transition ordering, trigger matching, and guard evaluation.

## RuntimeWaitingStateStore API

File: src/runtime/workflows/RuntimeWaitingStateStore.ts
- save(record): RuntimeWaitingStateRecord
- latest(waitingStateId: string): RuntimeWaitingStateRecord
- history(waitingStateId: string): readonly RuntimeWaitingStateRecord[]
- listLatest(): readonly RuntimeWaitingStateRecord[]
- listActiveForInstance(workflowInstanceId: string): readonly RuntimeWaitingStateRecord[]

Purpose:
- Revisioned waiting-state persistence and retrieval.

## RuntimeCompensationEngine API

File: src/runtime/workflows/RuntimeCompensationEngine.ts
- deriveActivities(workflow, failedActivityId): readonly RuntimeActivityRecord[]
- deriveDefinitions(workflow, failedActivityId): readonly RuntimeCompensationDefinitionRecord[]

Purpose:
- Deterministic compensation activity derivation for explicit forward compensation flows.

## RuntimeWorkflowManager API

File: src/runtime/workflows/RuntimeWorkflowManager.ts
- static fromExecutionContext(context: RuntimeExecutionContext): RuntimeWorkflowManager
- registerWorkflow(descriptor: RuntimeWorkflowDescriptor)
- materializeWorkflow(workflowId, request): RuntimeWorkflowInstanceRecord
- startWorkflow(workflowInstanceId): RuntimeWorkflowInstanceRecord
- transitionWorkflow(workflowInstanceId, nextState): RuntimeWorkflowInstanceRecord
- runEligibleActivities(workflowInstanceId, scheduling?, messaging?, triggerContext?): RuntimeWorkflowRunResult
- submitExecutionIntent(intentId, scheduling, messaging?, currentSequence?): RuntimeWorkflowRunResult
- observeEnvelope(workflowInstanceId, envelope): RuntimeWorkflowInstanceRecord
- completeActivity(workflowInstanceId, activityId, observation?): RuntimeWorkflowInstanceRecord
- failActivity(workflowInstanceId, activityId, reason): RuntimeWorkflowInstanceRecord
- startCompensation(workflowInstanceId, scheduling?, messaging?, currentSequence?): RuntimeWorkflowRunResult
- completeCompensation(workflowInstanceId, activityId): RuntimeWorkflowInstanceRecord
- archiveWorkflow(workflowInstanceId): RuntimeWorkflowInstanceRecord
- snapshot(): RuntimeWorkflowSnapshot
- persistSnapshot(): RuntimeWorkflowSnapshotRecord
- restoreLatestSnapshot(): RuntimeWorkflowSnapshotRecord
- snapshotHistory(): readonly RuntimeWorkflowSnapshotRecord[]
- replay(workflowInstanceId): RuntimeWorkflowReplayProjection
- workflow(workflowId)
- graph(workflowId): RuntimeActivityGraph
- instance(workflowInstanceId): RuntimeWorkflowInstanceRecord
- intent(intentId): RuntimeExecutionIntentRecord
- listWorkflows()
- listInstances()
- listExecutionIntents()

Purpose:
- Context-owned workflow orchestration manager with deterministic lifecycle, intent generation, waiting/compensation handling, snapshotting, and replay verification.

## Scheduler Integration

- Workflow emits RuntimeExecutionIntent only.
- Scheduler remains owner of RuntimeSchedule and RuntimePlan semantics.
- Workflow records RuntimePlan linkage references and observed publication outcomes.

## Messaging Integration

- Workflow does not publish runtime commands directly.
- RuntimeSchedulingManager publishes Runtime Command envelopes through RuntimeMessagingManager.
- Workflow observes runtime envelopes and scheduler publication outcomes for deterministic continuation.
