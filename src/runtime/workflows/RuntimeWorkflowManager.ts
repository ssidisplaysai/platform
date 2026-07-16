import { createHash } from "node:crypto";

import type { RuntimeEnvelopeSnapshot, RuntimeMessagingManager, RuntimePublishResult } from "../messaging";
import type { RuntimePlanRecord, RuntimeSchedulingManager } from "../scheduling";
import type { RuntimeExecutionContext } from "../services";
import { RuntimeActivityGraph } from "./RuntimeActivityGraph";
import { RuntimeCompensationEngine } from "./RuntimeCompensationEngine";
import { RuntimeExecutionIntent } from "./RuntimeExecutionIntent";
import { RuntimeTransitionEngine } from "./RuntimeTransitionEngine";
import { RuntimeWaitingStateStore } from "./RuntimeWaitingStateStore";
import { RuntimeWorkflowDiagnostics } from "./RuntimeWorkflowDiagnostics";
import { RuntimeWorkflowEvidence } from "./RuntimeWorkflowEvidence";
import { RuntimeWorkflowFactory } from "./RuntimeWorkflowFactory";
import { RuntimeWorkflowInstance } from "./RuntimeWorkflowInstance";
import { RuntimeWorkflowSnapshotStore } from "./RuntimeWorkflowSnapshotStore";
import { RuntimeWorkflowTelemetry } from "./RuntimeWorkflowTelemetry";
import type {
  RuntimeActivityRecord,
  RuntimeExecutionIntentRecord,
  RuntimeObservationType,
  RuntimePlanReference,
  RuntimeWaitingStateRecord,
  RuntimeWorkflowDescriptor,
  RuntimeWorkflowInstanceRecord,
  RuntimeWorkflowMaterializationRequest,
  RuntimeWorkflowObservation,
  RuntimeWorkflowReplayProjection,
  RuntimeWorkflowRunResult,
  RuntimeWorkflowSnapshot,
  RuntimeWorkflowSnapshotRecord,
  RuntimeWorkflowState,
} from "./types";
import {
  deepFreeze,
  observationMessageType,
  stablePrimitiveRecord,
  stableSerialize,
  stableStringArray,
  stableUnknownRecord,
} from "./types";

const WORKFLOW_TRANSITIONS: Readonly<Record<RuntimeWorkflowState, readonly RuntimeWorkflowState[]>> = Object.freeze({
  Declared: ["Registered"],
  Registered: ["Materialized"],
  Materialized: ["Ready"],
  Ready: ["Running", "Archived"],
  Running: ["Waiting", "Completed", "Failed", "Archived"],
  Waiting: ["Resuming", "Failed", "Archived"],
  Resuming: ["Running", "Waiting", "Completed", "Failed"],
  Completed: ["Archived"],
  Failed: ["Compensating", "Archived"],
  Compensating: ["Compensated", "CompensationFailed"],
  Compensated: ["Archived"],
  CompensationFailed: ["Archived"],
  Archived: [],
});

export class RuntimeWorkflowManager {
  private readonly factory = new RuntimeWorkflowFactory();
  private readonly transitions = new RuntimeTransitionEngine();
  private readonly waiting = new RuntimeWaitingStateStore();
  private readonly compensation = new RuntimeCompensationEngine();
  private readonly evidence = new RuntimeWorkflowEvidence();
  private readonly diagnostics = new RuntimeWorkflowDiagnostics();
  private readonly telemetry = new RuntimeWorkflowTelemetry();
  private readonly snapshots = new RuntimeWorkflowSnapshotStore();
  private readonly workflows = new Map<string, ReturnType<RuntimeWorkflowManager["workflow"]>>();
  private readonly graphs = new Map<string, RuntimeActivityGraph>();
  private readonly instances = new Map<string, RuntimeWorkflowInstanceRecord>();
  private readonly intents = new Map<string, RuntimeExecutionIntentRecord>();
  private readonly observations = new Map<string, RuntimeWorkflowObservation[]>();

  constructor(
    readonly runtimeInstanceId: string,
    readonly runtimeId: string,
  ) {}

  static fromExecutionContext(context: RuntimeExecutionContext): RuntimeWorkflowManager {
    return new RuntimeWorkflowManager(context.runtimeInstanceId, context.runtimeId);
  }

  registerWorkflow(descriptor: RuntimeWorkflowDescriptor) {
    const workflow = this.factory.create(descriptor).snapshot();
    if (this.workflows.has(workflow.workflowId)) {
      throw new Error(`GRT-WF-MANAGER-001: Duplicate workflow registration: ${workflow.workflowId}`);
    }
    const graph = new RuntimeActivityGraph(workflow);
    this.workflows.set(workflow.workflowId, workflow);
    this.graphs.set(workflow.workflowId, graph);
    this.telemetry.increment("workflow.registered");
    this.evidence.append(this.runtimeInstanceId, "WorkflowRegistered", { name: workflow.name, version: workflow.version }, { workflowId: workflow.workflowId });
    return workflow;
  }

  materializeWorkflow(
    workflowId: string,
    request: RuntimeWorkflowMaterializationRequest,
  ): RuntimeWorkflowInstanceRecord {
    const workflow = this.workflow(workflowId);
    const workflowInstanceId = this.factory.workflowInstanceIdentityFor(this.runtimeInstanceId, workflowId, request);
    const existing = this.instances.get(workflowInstanceId);
    if (existing) {
      return existing;
    }
    const instance = new RuntimeWorkflowInstance(deepFreeze({
      workflowInstanceId,
      workflowId,
      runtimeInstanceId: this.runtimeInstanceId,
      runtimeId: this.runtimeId,
      state: "Materialized",
      activeActivityIds: Object.freeze([]),
      completedActivityIds: Object.freeze([]),
      failedActivityIds: Object.freeze([]),
      waitingStateIds: Object.freeze([]),
      compensationState: deepFreeze({ status: "NotRequired", activityIds: Object.freeze([]), intentIds: Object.freeze([]) }),
      executionIntentIds: Object.freeze([]),
      runtimePlanReferences: Object.freeze([]),
      correlationId: request.correlationId,
      causationId: request.causationId,
      revision: 1,
      metadata: stablePrimitiveRecord(request.metadata),
    })).snapshot();
    this.instances.set(workflowInstanceId, instance);
    this.observations.set(workflowInstanceId, []);
    this.telemetry.increment("workflow.materialized");
    this.evidence.append(this.runtimeInstanceId, "WorkflowMaterialized", { workflowName: workflow.name }, {
      workflowId,
      workflowInstanceId,
    });
    return instance;
  }

  startWorkflow(workflowInstanceId: string): RuntimeWorkflowInstanceRecord {
    const materialized = this.instance(workflowInstanceId);
    if (materialized.state === "Materialized") {
      this.transitionInstance(workflowInstanceId, "Ready");
    }
    const ready = this.instance(workflowInstanceId);
    if (ready.state !== "Ready") {
      throw new Error(`GRT-WF-LIFECYCLE-001: Workflow instance cannot start from ${ready.state}`);
    }
    const running = this.transitionInstance(workflowInstanceId, "Running");
    this.telemetry.increment("workflow.started");
    this.evidence.append(this.runtimeInstanceId, "WorkflowStarted", { revision: running.revision }, {
      workflowId: running.workflowId,
      workflowInstanceId,
    });
    return running;
  }

  transitionWorkflow(workflowInstanceId: string, nextState: RuntimeWorkflowState): RuntimeWorkflowInstanceRecord {
    return this.transitionInstance(workflowInstanceId, nextState);
  }

  runEligibleActivities(
    workflowInstanceId: string,
    scheduling?: RuntimeSchedulingManager,
    messaging?: RuntimeMessagingManager,
    triggerContext: { currentSequence: number } = { currentSequence: 1 },
  ): RuntimeWorkflowRunResult {
    let current = this.instance(workflowInstanceId);
    if (current.state === "Materialized") {
      current = this.startWorkflow(workflowInstanceId);
    } else if (current.state === "Ready") {
      current = this.startWorkflow(workflowInstanceId);
    } else if (current.state === "Resuming") {
      current = this.transitionInstance(workflowInstanceId, "Running");
    }

    if (!["Running", "Waiting"].includes(current.state)) {
      throw new Error(`GRT-WF-MANAGER-002: Workflow instance is not runnable from state ${current.state}`);
    }

    if (current.state === "Waiting" && this.waiting.listActiveForInstance(workflowInstanceId).length > 0) {
      return deepFreeze({ createdIntents: Object.freeze([]), linkedPlans: Object.freeze([]), publishedMessages: Object.freeze([]) });
    }

    const workflow = this.workflow(current.workflowId);
    const graph = this.graph(workflow.workflowId);
    const eligible = graph.eligibleActivities(current);
    const createdIntents: RuntimeExecutionIntentRecord[] = [];
    const linkedPlans: RuntimePlanReference[] = [];
    const publishedMessages: RuntimePublishResult[] = [];
    let enteredWaiting = false;

    for (const activity of eligible) {
      this.telemetry.increment("activity.eligible");
      this.evidence.append(this.runtimeInstanceId, "ActivityEligible", { activityType: activity.activityType }, {
        workflowId: workflow.workflowId,
        workflowInstanceId,
        activityId: activity.activityId,
      });

      const intent = this.createExecutionIntent(current, activity);
      createdIntents.push(intent);
      current = this.instance(workflowInstanceId);

      if (activity.waitingPolicy || workflow.waitingDefinitions.some((definition) => definition.activityId === activity.activityId)) {
        enteredWaiting = true;
        this.enterWaitingState(current, workflow, activity);
        current = this.instance(workflowInstanceId);
      }

      if (scheduling) {
        const submission = this.submitExecutionIntent(intent.intentId, scheduling, messaging, triggerContext.currentSequence);
        linkedPlans.push(...submission.linkedPlans);
        publishedMessages.push(...submission.publishedMessages);
      }
    }

    if (enteredWaiting) {
      const stateful = this.instance(workflowInstanceId);
      if (stateful.state === "Running") {
        this.transitionInstance(workflowInstanceId, "Waiting");
      }
    }

    this.refreshCompletion(workflowInstanceId);
    return deepFreeze({
      createdIntents: Object.freeze(createdIntents),
      linkedPlans: Object.freeze(linkedPlans),
      publishedMessages: Object.freeze(publishedMessages),
    });
  }

  submitExecutionIntent(
    intentId: string,
    scheduling: RuntimeSchedulingManager,
    messaging?: RuntimeMessagingManager,
    currentSequence = 1,
  ): RuntimeWorkflowRunResult {
    const intent = this.intent(intentId);
    const schedule = this.registerOrReuseSchedule(intent, scheduling);
    const plan = scheduling.generatePlan(schedule.scheduleId, { currentSequence });
    const linkedPlan = this.linkRuntimePlan(intent, plan);
    const linkedPlans = [linkedPlan];
    const publishedMessages: RuntimePublishResult[] = [];

    if (messaging) {
      const published = scheduling.publishPlan(plan.planId, messaging);
      publishedMessages.push(published);
      this.updatePlanPublication(intent.workflowInstanceId, linkedPlan.planId, published.envelope.messageId);
      this.observeSchedulerPublication(intent.workflowInstanceId, intent, linkedPlan, published);
    }

    return deepFreeze({
      createdIntents: Object.freeze([]),
      linkedPlans: Object.freeze(linkedPlans),
      publishedMessages: Object.freeze(publishedMessages),
    });
  }

  observeEnvelope(workflowInstanceId: string, envelope: RuntimeEnvelopeSnapshot): RuntimeWorkflowInstanceRecord {
    const observation = this.recordObservation(workflowInstanceId, {
      observationType: "Envelope",
      triggerType: "WaitingObserved",
      messageId: envelope.messageId,
      envelopeType: envelope.envelopeType,
      channel: envelope.channel,
      topic: envelope.topic,
      messageType: typeof envelope.payload.messageType === "string" ? envelope.payload.messageType : undefined,
      correlationId: envelope.correlationId,
      causationId: envelope.causationId,
      payload: stableUnknownRecord(envelope.payload),
      metadata: stablePrimitiveRecord(envelope.metadata),
    });
    return this.applyObservation(workflowInstanceId, observation);
  }

  completeActivity(workflowInstanceId: string, activityId: string, observation?: RuntimeWorkflowObservation): RuntimeWorkflowInstanceRecord {
    const current = this.instance(workflowInstanceId);
    const workflow = this.workflow(current.workflowId);
    const next = this.updateInstance(workflowInstanceId, (instance) => ({
      ...instance,
      activeActivityIds: Object.freeze(instance.activeActivityIds.filter((entry) => entry !== activityId)),
      completedActivityIds: stableStringArray([...instance.completedActivityIds, activityId]),
      waitingStateIds: Object.freeze(instance.waitingStateIds.filter((waitingStateId) => !waitingStateId.includes(activityId))),
    }));

    this.telemetry.increment("activity.completed");
    this.evidence.append(this.runtimeInstanceId, "ActivityCompleted", { messageType: observationMessageType(observation ?? { metadata: {}, workflowInstanceId, observationId: "", observationType: "Envelope", triggerType: "ActivityCompleted" } as RuntimeWorkflowObservation) }, {
      workflowId: workflow.workflowId,
      workflowInstanceId,
      activityId,
    });

    const application = this.transitions.evaluate(this.graph(workflow.workflowId).snapshot(), activityId, this.graph(workflow.workflowId).transitionsFrom(activityId), observation ?? this.syntheticObservation(workflowInstanceId, "ActivityCompleted"));
    for (const transitionId of application.transitionIds) {
      this.telemetry.increment("transition.applied");
      this.evidence.append(this.runtimeInstanceId, "TransitionApplied", { transitionId }, {
        workflowId: workflow.workflowId,
        workflowInstanceId,
        activityId,
      });
    }

    this.refreshCompletion(workflowInstanceId);
    return next;
  }

  failActivity(workflowInstanceId: string, activityId: string, reason: string): RuntimeWorkflowInstanceRecord {
    const current = this.instance(workflowInstanceId);
    const workflow = this.workflow(current.workflowId);
    const next = this.updateInstance(workflowInstanceId, (instance) => ({
      ...instance,
      state: instance.state === "Compensating" ? "CompensationFailed" : "Failed",
      activeActivityIds: Object.freeze(instance.activeActivityIds.filter((entry) => entry !== activityId)),
      failedActivityIds: stableStringArray([...instance.failedActivityIds, activityId]),
      waitingStateIds: Object.freeze(instance.waitingStateIds.filter((waitingStateId) => !waitingStateId.includes(activityId))),
      compensationState: instance.state === "Compensating"
        ? deepFreeze({ ...instance.compensationState, status: "Failed", failedActivityId: activityId })
        : instance.compensationState,
    }));

    this.telemetry.increment("activity.failed");
    this.telemetry.increment("workflow.failed");
    this.evidence.append(this.runtimeInstanceId, next.state === "CompensationFailed" ? "CompensationFailed" : "ActivityFailed", { reason }, {
      workflowId: workflow.workflowId,
      workflowInstanceId,
      activityId,
    });
    if (next.state === "Failed") {
      this.evidence.append(this.runtimeInstanceId, "WorkflowFailed", { reason }, {
        workflowId: workflow.workflowId,
        workflowInstanceId,
        activityId,
      });
    }
    return next;
  }

  startCompensation(
    workflowInstanceId: string,
    scheduling?: RuntimeSchedulingManager,
    messaging?: RuntimeMessagingManager,
    currentSequence = 1,
  ): RuntimeWorkflowRunResult {
    const current = this.instance(workflowInstanceId);
    if (current.state !== "Failed" && current.state !== "Compensating") {
      throw new Error(`GRT-WF-COMP-001: Workflow instance cannot compensate from ${current.state}`);
    }
    const workflow = this.workflow(current.workflowId);
    const failedActivityId = current.failedActivityIds[current.failedActivityIds.length - 1];
    if (!failedActivityId) {
      throw new Error("GRT-WF-COMP-002: Compensation requires a failed activity");
    }

    const activities = this.compensation.deriveActivities(workflow, failedActivityId);
    if (activities.length === 0) {
      return deepFreeze({ createdIntents: Object.freeze([]), linkedPlans: Object.freeze([]), publishedMessages: Object.freeze([]) });
    }

    this.transitionInstance(workflowInstanceId, "Compensating");
    let updated = this.updateInstance(workflowInstanceId, (instance) => ({
      ...instance,
      compensationState: deepFreeze({ status: "Running", failedActivityId, activityIds: Object.freeze(activities.map((activity) => activity.activityId)), intentIds: Object.freeze([]) }),
    }));

    this.telemetry.increment("compensation.started");
    this.evidence.append(this.runtimeInstanceId, "CompensationStarted", { failedActivityId, compensationCount: activities.length }, {
      workflowId: workflow.workflowId,
      workflowInstanceId,
      activityId: failedActivityId,
    });

    const createdIntents: RuntimeExecutionIntentRecord[] = [];
    const linkedPlans: RuntimePlanReference[] = [];
    const publishedMessages: RuntimePublishResult[] = [];

    for (const activity of activities) {
      const intent = this.createExecutionIntent(updated, activity, { compensation: true });
      createdIntents.push(intent);
      updated = this.updateInstance(workflowInstanceId, (instance) => ({
        ...instance,
        compensationState: deepFreeze({
          ...instance.compensationState,
          intentIds: stableStringArray([...instance.compensationState.intentIds, intent.intentId]),
        }),
      }));
      this.telemetry.increment("compensation.started");
      this.evidence.append(this.runtimeInstanceId, "CompensationIntentCreated", { activityId: activity.activityId }, {
        workflowId: workflow.workflowId,
        workflowInstanceId,
        activityId: activity.activityId,
        intentId: intent.intentId,
      });
      if (scheduling) {
        const submission = this.submitExecutionIntent(intent.intentId, scheduling, messaging, currentSequence);
        linkedPlans.push(...submission.linkedPlans);
        publishedMessages.push(...submission.publishedMessages);
      }
    }

    return deepFreeze({
      createdIntents: Object.freeze(createdIntents),
      linkedPlans: Object.freeze(linkedPlans),
      publishedMessages: Object.freeze(publishedMessages),
    });
  }

  completeCompensation(workflowInstanceId: string, activityId: string): RuntimeWorkflowInstanceRecord {
    const updated = this.completeActivity(workflowInstanceId, activityId, this.syntheticObservation(workflowInstanceId, "CompensationCompleted"));
    const current = this.instance(workflowInstanceId);
    if (current.compensationState.activityIds.every((entry) => current.completedActivityIds.includes(entry))) {
      const compensated = this.updateInstance(workflowInstanceId, (instance) => ({
        ...instance,
        state: "Compensated",
        compensationState: deepFreeze({ ...instance.compensationState, status: "Completed" }),
      }));
      this.telemetry.increment("compensation.completed");
      this.evidence.append(this.runtimeInstanceId, "CompensationCompleted", { activityId }, {
        workflowId: compensated.workflowId,
        workflowInstanceId,
        activityId,
      });
      return compensated;
    }
    return updated;
  }

  archiveWorkflow(workflowInstanceId: string): RuntimeWorkflowInstanceRecord {
    const archived = this.transitionInstance(workflowInstanceId, "Archived");
    this.telemetry.increment("workflow.archived");
    this.evidence.append(this.runtimeInstanceId, "WorkflowArchived", { revision: archived.revision }, {
      workflowId: archived.workflowId,
      workflowInstanceId,
    });
    return archived;
  }

  snapshot(): RuntimeWorkflowSnapshot {
    const workflowDefinitions = this.listWorkflows();
    const workflowInstances = this.listInstances();
    const activityGraphs = Object.freeze([...this.graphs.values()].map((graph) => graph.snapshot()).sort((a, b) => a.workflowId.localeCompare(b.workflowId)));
    const waitingStates = this.waiting.listLatest();
    const executionIntents = this.listExecutionIntents();
    const observations = Object.freeze(
      [...this.observations.values()]
        .flat()
        .sort((a, b) => a.observationId.localeCompare(b.observationId)),
    );

    return deepFreeze({
      runtimeInstanceId: this.runtimeInstanceId,
      runtimeId: this.runtimeId,
      workflowDefinitions,
      workflowInstances,
      activityGraphs,
      waitingStates,
      executionIntents,
      observations,
      diagnostics: this.diagnostics.all(),
      evidence: this.evidence.all(),
      telemetry: this.telemetry.snapshot({
        workflowCount: workflowDefinitions.length,
        instanceCount: workflowInstances.length,
        graphCount: activityGraphs.length,
        waitingStateCount: waitingStates.length,
        executionIntentCount: executionIntents.length,
        runtimePlanReferenceCount: workflowInstances.reduce((count, entry) => count + entry.runtimePlanReferences.length, 0),
        observationCount: observations.length,
        diagnosticsCount: this.diagnostics.all().length,
        evidenceCount: this.evidence.all().length,
        snapshotCount: this.snapshots.history(this.runtimeInstanceId).length,
      }),
    });
  }

  persistSnapshot(): RuntimeWorkflowSnapshotRecord {
    const record = this.snapshots.save(this.snapshot());
    this.telemetry.increment("snapshot.created");
    this.evidence.append(this.runtimeInstanceId, "SnapshotPersisted", { revision: record.revision });
    return record;
  }

  restoreLatestSnapshot(): RuntimeWorkflowSnapshotRecord {
    return this.snapshots.loadLatest(this.runtimeInstanceId);
  }

  snapshotHistory(): readonly RuntimeWorkflowSnapshotRecord[] {
    return this.snapshots.history(this.runtimeInstanceId);
  }

  replay(workflowInstanceId: string): RuntimeWorkflowReplayProjection {
    const workflowInstance = this.instance(workflowInstanceId);
    const waitingStates = this.waiting.listLatest().filter((entry) => entry.workflowInstanceId === workflowInstanceId);
    const executionIntents = this.listExecutionIntents().filter((entry) => entry.workflowInstanceId === workflowInstanceId);
    const observations = Object.freeze([...(this.observations.get(workflowInstanceId) ?? [])].sort((a, b) => a.observationId.localeCompare(b.observationId)));
    const evidence = Object.freeze(this.evidence.all().filter((entry) => entry.workflowInstanceId === workflowInstanceId));
    const verificationHash = createHash("sha256")
      .update(stableSerialize({ workflowInstance, waitingStates, executionIntents, planReferences: workflowInstance.runtimePlanReferences, observations, evidence }))
      .digest("hex");

    return deepFreeze({
      workflowInstance,
      waitingStates,
      executionIntents,
      runtimePlanReferences: workflowInstance.runtimePlanReferences,
      observations,
      evidence,
      verificationHash,
    });
  }

  workflow(workflowId: string) {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`GRT-WF-MANAGER-003: Unknown workflow: ${workflowId}`);
    }
    return workflow;
  }

  graph(workflowId: string): RuntimeActivityGraph {
    const graph = this.graphs.get(workflowId);
    if (!graph) {
      throw new Error(`GRT-WF-MANAGER-004: Missing graph for workflow: ${workflowId}`);
    }
    return graph;
  }

  instance(workflowInstanceId: string): RuntimeWorkflowInstanceRecord {
    const instance = this.instances.get(workflowInstanceId);
    if (!instance) {
      throw new Error(`GRT-WF-MANAGER-005: Unknown workflow instance: ${workflowInstanceId}`);
    }
    return instance;
  }

  intent(intentId: string): RuntimeExecutionIntentRecord {
    const intent = this.intents.get(intentId);
    if (!intent) {
      throw new Error(`GRT-WF-MANAGER-006: Unknown workflow execution intent: ${intentId}`);
    }
    return intent;
  }

  listWorkflows() {
    return Object.freeze([...this.workflows.values()].sort((a, b) => a.workflowId.localeCompare(b.workflowId)));
  }

  listInstances() {
    return Object.freeze([...this.instances.values()].sort((a, b) => a.workflowInstanceId.localeCompare(b.workflowInstanceId)));
  }

  listExecutionIntents() {
    return Object.freeze([...this.intents.values()].sort((a, b) => a.intentId.localeCompare(b.intentId)));
  }

  private createExecutionIntent(
    instance: RuntimeWorkflowInstanceRecord,
    activity: RuntimeActivityRecord,
    metadata: Readonly<Record<string, string | number | boolean | null>> = {},
  ): RuntimeExecutionIntentRecord {
    const ordinal = this.listExecutionIntents().filter((entry) =>
      entry.workflowInstanceId === instance.workflowInstanceId && entry.activityId === activity.activityId).length + 1;

    const base = deepFreeze({
      workflowId: instance.workflowId,
      workflowInstanceId: instance.workflowInstanceId,
      activityId: activity.activityId,
      runtimeInstanceId: instance.runtimeInstanceId,
      runtimeId: instance.runtimeId,
      targetKind: activity.targetKind,
      targetId: activity.targetId,
      targetCapability: activity.targetCapability,
      commandChannel: activity.commandChannel,
      commandTopic: activity.commandTopic,
      payload: stableUnknownRecord(activity.input),
      priority: Number(activity.metadata.priority ?? 0),
      executionConstraints: deepFreeze({ scheduleType: "Immediate" as const, metadata: stablePrimitiveRecord(activity.metadata) }),
      correlationId: instance.correlationId,
      causationId: instance.causationId,
      attempt: ordinal,
      metadata: stablePrimitiveRecord({ ...activity.metadata, ...metadata }),
      schemaVersion: activity.version,
    });

    const intent = new RuntimeExecutionIntent(deepFreeze({
      ...base,
      intentId: this.factory.executionIntentIdentityFor(base, ordinal),
    })).snapshot();

    this.intents.set(intent.intentId, intent);
    this.updateInstance(instance.workflowInstanceId, (current) => ({
      ...current,
      activeActivityIds: stableStringArray([...current.activeActivityIds, activity.activityId]),
      executionIntentIds: stableStringArray([...current.executionIntentIds, intent.intentId]),
    }));

    this.telemetry.increment("activity.started");
    this.telemetry.increment("intent.created");
    this.evidence.append(this.runtimeInstanceId, "ActivityStarted", { targetId: activity.targetId }, {
      workflowId: instance.workflowId,
      workflowInstanceId: instance.workflowInstanceId,
      activityId: activity.activityId,
      intentId: intent.intentId,
    });
    this.evidence.append(this.runtimeInstanceId, "ExecutionIntentCreated", { commandTopic: activity.commandTopic }, {
      workflowId: instance.workflowId,
      workflowInstanceId: instance.workflowInstanceId,
      activityId: activity.activityId,
      intentId: intent.intentId,
    });

    return intent;
  }

  private registerOrReuseSchedule(intent: RuntimeExecutionIntentRecord, scheduling: RuntimeSchedulingManager) {
    const descriptor = {
      scheduleType: intent.executionConstraints.scheduleType,
      targetKind: intent.targetKind,
      targetId: intent.targetId,
      targetCapability: intent.targetCapability,
      commandChannel: intent.commandChannel,
      commandTopic: intent.commandTopic,
      commandPayload: intent.payload,
      trigger: intent.executionConstraints.requiredSequence !== undefined
        ? { triggerType: "Slot" as const, slot: { slotId: `slot-${intent.executionConstraints.requiredSequence.toString().padStart(6, "0")}`, sequence: intent.executionConstraints.requiredSequence, window: "workflow" } }
        : { triggerType: "Immediate" as const },
      executionWindow: { windowId: `workflow-window-${intent.activityId}`, allowedSequences: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), graceSequences: Object.freeze([]) },
      retryPolicy: { policyType: "FixedAttempts" as const, maxAttempts: 1, interval: 1 },
      expirationPolicy: {},
      priority: intent.priority,
      metadata: stablePrimitiveRecord({
        intentId: intent.intentId,
        workflowId: intent.workflowId,
        workflowInstanceId: intent.workflowInstanceId,
        activityId: intent.activityId,
      }),
      version: intent.schemaVersion,
    };

    try {
      return scheduling.registerSchedule(descriptor);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("GRT-SCH-MANAGER-001")) {
        this.telemetry.increment("intent.rejected");
        this.diagnostics.log(this.runtimeInstanceId, "Error", "GRT-WF-SCH-001", "scheduler integration failed", {
          workflowId: intent.workflowId,
          workflowInstanceId: intent.workflowInstanceId,
          activityId: intent.activityId,
        }, { message: error instanceof Error ? error.message : String(error) });
        throw error;
      }
      const existing = scheduling.listSchedules().find((entry) => entry.metadata.intentId === intent.intentId);
      if (!existing) {
        throw error;
      }
      return existing;
    }
  }

  private linkRuntimePlan(intent: RuntimeExecutionIntentRecord, plan: RuntimePlanRecord): RuntimePlanReference {
    const current = this.instance(intent.workflowInstanceId);
    const existing = current.runtimePlanReferences.find((entry) => entry.planId === plan.planId);
    if (existing) {
      return existing;
    }

    const reference = deepFreeze({
      sequence: current.runtimePlanReferences.length + 1,
      intentId: intent.intentId,
      scheduleId: plan.scheduleId,
      planId: plan.planId,
      publishedMessageId: undefined,
    });

    this.updateInstance(intent.workflowInstanceId, (instance) => ({
      ...instance,
      runtimePlanReferences: Object.freeze([...instance.runtimePlanReferences, reference]),
    }));
    this.evidence.append(this.runtimeInstanceId, "RuntimePlanLinked", { scheduleId: plan.scheduleId }, {
      workflowId: intent.workflowId,
      workflowInstanceId: intent.workflowInstanceId,
      activityId: intent.activityId,
      intentId: intent.intentId,
      planId: plan.planId,
    });
    return reference;
  }

  private updatePlanPublication(workflowInstanceId: string, planId: string, publishedMessageId: string): void {
    this.updateInstance(workflowInstanceId, (instance) => ({
      ...instance,
      runtimePlanReferences: Object.freeze(instance.runtimePlanReferences.map((entry) =>
        entry.planId === planId ? deepFreeze({ ...entry, publishedMessageId }) : entry)),
    }));
  }

  private observeSchedulerPublication(
    workflowInstanceId: string,
    intent: RuntimeExecutionIntentRecord,
    linkedPlan: RuntimePlanReference,
    published: RuntimePublishResult,
  ): void {
    const observation = this.recordObservation(workflowInstanceId, {
      observationType: "SchedulerPublicationResult",
      triggerType: "SchedulerPublished",
      messageId: published.envelope.messageId,
      envelopeType: published.envelope.envelopeType,
      channel: published.envelope.channel,
      topic: published.envelope.topic,
      correlationId: published.envelope.correlationId,
      causationId: published.envelope.causationId,
      payload: stableUnknownRecord(published.envelope.payload),
      metadata: stablePrimitiveRecord({ scheduleId: linkedPlan.scheduleId, planId: linkedPlan.planId, intentId: intent.intentId }),
      scheduleId: linkedPlan.scheduleId,
      planId: linkedPlan.planId,
      intentId: intent.intentId,
    });
    void this.applyObservation(workflowInstanceId, observation);
  }

  private recordObservation(
    workflowInstanceId: string,
    details: Omit<RuntimeWorkflowObservation, "observationId" | "workflowInstanceId">,
  ): RuntimeWorkflowObservation {
    const history = this.observations.get(workflowInstanceId) ?? [];
    const observation = deepFreeze({
      observationId: `observation-${createHash("sha256").update(stableSerialize({ workflowInstanceId, details })).digest("hex").slice(0, 16)}`,
      workflowInstanceId,
      ...details,
    });
    this.observations.set(workflowInstanceId, [...history, observation].sort((a, b) => a.observationId.localeCompare(b.observationId)));
    return observation;
  }

  private applyObservation(workflowInstanceId: string, observation: RuntimeWorkflowObservation): RuntimeWorkflowInstanceRecord {
    const current = this.instance(workflowInstanceId);
    const workflow = this.workflow(current.workflowId);
    const waitingStates = this.waiting.listActiveForInstance(workflowInstanceId);

    for (const waitingState of waitingStates) {
      const channelTopicMatch = (!waitingState.expectedChannel || waitingState.expectedChannel === observation.channel)
        && (!waitingState.expectedTopic || waitingState.expectedTopic === observation.topic);
      if (!channelTopicMatch) {
        continue;
      }
      if (waitingState.correlationId && waitingState.correlationId !== observation.correlationId) {
        this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-WF-WAIT-002", "correlation mismatch", {
          workflowId: workflow.workflowId,
          workflowInstanceId,
          activityId: waitingState.activityId,
          waitingStateId: waitingState.waitingStateId,
        }, { expected: waitingState.correlationId, actual: observation.correlationId });
        continue;
      }
      if (waitingState.causationId && waitingState.causationId !== observation.causationId) {
        this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-WF-WAIT-003", "causation mismatch", {
          workflowId: workflow.workflowId,
          workflowInstanceId,
          activityId: waitingState.activityId,
          waitingStateId: waitingState.waitingStateId,
        }, { expected: waitingState.causationId, actual: observation.causationId });
        continue;
      }
      if (waitingState.expectedEnvelopeType && waitingState.expectedEnvelopeType !== observation.envelopeType) {
        continue;
      }
      if (waitingState.expectedMessageType && waitingState.expectedMessageType !== observationMessageType(observation)) {
        continue;
      }

      this.telemetry.increment("waiting.observed");
      this.evidence.append(this.runtimeInstanceId, "WaitingStateObserved", { observationType: observation.observationType }, {
        workflowId: workflow.workflowId,
        workflowInstanceId,
        activityId: waitingState.activityId,
        waitingStateId: waitingState.waitingStateId,
      });
      this.waiting.save({ ...waitingState, state: "Observed" });
      if (this.instance(workflowInstanceId).state === "Waiting") {
        this.transitionInstance(workflowInstanceId, "Resuming");
      }
      this.waiting.save({ ...this.waiting.latest(waitingState.waitingStateId), state: "Resumed" });
      this.telemetry.increment("waiting.resumed");
      this.evidence.append(this.runtimeInstanceId, "WaitingStateResumed", { observationId: observation.observationId }, {
        workflowId: workflow.workflowId,
        workflowInstanceId,
        activityId: waitingState.activityId,
        waitingStateId: waitingState.waitingStateId,
      });
      this.updateInstance(workflowInstanceId, (instance) => ({
        ...instance,
        waitingStateIds: Object.freeze(instance.waitingStateIds.filter((entry) => entry !== waitingState.waitingStateId)),
      }));
      if (waitingState.resumePolicy === "FailActivity") {
        return this.failActivity(workflowInstanceId, waitingState.activityId, waitingState.waitingReason);
      }
      if (waitingState.resumePolicy === "CompleteActivity") {
        return this.completeActivity(workflowInstanceId, waitingState.activityId, observation);
      }
      return this.instance(workflowInstanceId);
    }

    this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-WF-WAIT-004", "unresolved waiting state", {
      workflowId: workflow.workflowId,
      workflowInstanceId,
    }, { observationId: observation.observationId, observationType: observation.observationType });
    return current;
  }

  private enterWaitingState(
    instance: RuntimeWorkflowInstanceRecord,
    workflow: ReturnType<RuntimeWorkflowManager["workflow"]>,
    activity: RuntimeActivityRecord,
  ): RuntimeWaitingStateRecord {
    const waitingDefinition = workflow.waitingDefinitions.find((definition) => definition.activityId === activity.activityId);
    const policy = activity.waitingPolicy ?? (waitingDefinition ? {
      waitingReason: waitingDefinition.waitingReason,
      observationType: "RuntimeEvent" as const,
      expectedEnvelopeType: waitingDefinition.expectedEnvelopeType,
      expectedChannel: waitingDefinition.expectedChannel,
      expectedTopic: waitingDefinition.expectedTopic,
      expectedMessageType: waitingDefinition.expectedMessageType,
      correlationId: waitingDefinition.correlationId,
      causationId: waitingDefinition.causationId,
      resumePolicy: waitingDefinition.resumePolicy,
      metadata: waitingDefinition.metadata,
    } : undefined);

    if (!policy) {
      throw new Error(`GRT-WF-WAIT-005: Missing waiting policy for activity ${activity.activityId}`);
    }

    const waitingStateId = `waiting-state-${activity.activityId}-${createHash("sha256")
      .update(stableSerialize({ workflowInstanceId: instance.workflowInstanceId, activityId: activity.activityId, policy }))
      .digest("hex")
      .slice(0, 16)}`;

    const record = this.waiting.save({
      waitingStateId,
      workflowInstanceId: instance.workflowInstanceId,
      activityId: activity.activityId,
      waitingReason: policy.waitingReason,
      expectedEnvelopeType: policy.expectedEnvelopeType,
      expectedChannel: policy.expectedChannel,
      expectedTopic: policy.expectedTopic,
      expectedMessageType: policy.expectedMessageType,
      correlationId: policy.observationType === "SchedulerPublicationResult"
        ? policy.correlationId
        : (policy.correlationId ?? instance.correlationId),
      causationId: policy.observationType === "SchedulerPublicationResult"
        ? policy.causationId
        : (policy.causationId ?? instance.causationId),
      resumePolicy: policy.resumePolicy,
      state: "Active",
      metadata: stablePrimitiveRecord(policy.metadata),
    });

    this.updateInstance(instance.workflowInstanceId, (current) => ({
      ...current,
      waitingStateIds: stableStringArray([...current.waitingStateIds, waitingStateId]),
    }));
    this.telemetry.increment("waiting.entered");
    this.evidence.append(this.runtimeInstanceId, "WaitingStateEntered", { waitingReason: record.waitingReason }, {
      workflowId: workflow.workflowId,
      workflowInstanceId: instance.workflowInstanceId,
      activityId: activity.activityId,
      waitingStateId,
    });
    return record;
  }

  private refreshCompletion(workflowInstanceId: string): void {
    const instance = this.instance(workflowInstanceId);
    const workflow = this.workflow(instance.workflowId);
    const exitsComplete = workflow.exitActivityIds.length > 0
      && workflow.exitActivityIds.every((activityId) => instance.completedActivityIds.includes(activityId));
    if (exitsComplete && instance.state !== "Completed" && instance.state !== "Archived") {
      const completed = this.updateInstance(workflowInstanceId, (current) => ({ ...current, state: "Completed" }));
      this.telemetry.increment("workflow.completed");
      this.evidence.append(this.runtimeInstanceId, "WorkflowCompleted", { revision: completed.revision }, {
        workflowId: completed.workflowId,
        workflowInstanceId,
      });
    }
  }

  private transitionInstance(workflowInstanceId: string, nextState: RuntimeWorkflowState): RuntimeWorkflowInstanceRecord {
    const current = this.instance(workflowInstanceId);
    if (!WORKFLOW_TRANSITIONS[current.state].includes(nextState)) {
      throw new Error(`GRT-WF-LIFECYCLE-002: Illegal workflow transition ${current.state} -> ${nextState}`);
    }
    return this.updateInstance(workflowInstanceId, (instance) => ({ ...instance, state: nextState }));
  }

  private updateInstance(
    workflowInstanceId: string,
    mutate: (instance: RuntimeWorkflowInstanceRecord) => Omit<RuntimeWorkflowInstanceRecord, "revision"> | RuntimeWorkflowInstanceRecord,
  ): RuntimeWorkflowInstanceRecord {
    const current = this.instance(workflowInstanceId);
    const next = mutate(current);
    const persisted = new RuntimeWorkflowInstance(deepFreeze({
      ...next,
      revision: current.revision + 1,
      activeActivityIds: stableStringArray(next.activeActivityIds),
      completedActivityIds: stableStringArray(next.completedActivityIds),
      failedActivityIds: stableStringArray(next.failedActivityIds),
      waitingStateIds: stableStringArray(next.waitingStateIds),
      executionIntentIds: stableStringArray(next.executionIntentIds),
      runtimePlanReferences: Object.freeze([...next.runtimePlanReferences].sort((a, b) => a.sequence - b.sequence || a.planId.localeCompare(b.planId))),
      metadata: stablePrimitiveRecord(next.metadata),
      compensationState: deepFreeze({
        ...next.compensationState,
        activityIds: stableStringArray(next.compensationState.activityIds),
        intentIds: stableStringArray(next.compensationState.intentIds),
      }),
    })).snapshot();
    this.instances.set(workflowInstanceId, persisted);
    return persisted;
  }

  private syntheticObservation(workflowInstanceId: string, triggerType: RuntimeWorkflowObservation["triggerType"]): RuntimeWorkflowObservation {
    return deepFreeze({
      observationId: `synthetic-${triggerType.toLowerCase()}`,
      workflowInstanceId,
      observationType: "Envelope" as RuntimeObservationType,
      triggerType,
      metadata: {},
    });
  }
}
