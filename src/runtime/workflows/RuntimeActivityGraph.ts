import type {
  RuntimeActivityGraphEdge,
  RuntimeActivityGraphSnapshot,
  RuntimeActivityRecord,
  RuntimeTransitionRecord,
  RuntimeWorkflowInstanceRecord,
  RuntimeWorkflowRecord,
} from "./types";
import { deepFreeze, stableStringArray } from "./types";

function edgeKey(edge: RuntimeActivityGraphEdge): string {
  return `${edge.fromActivityId}:${edge.transitionId}:${edge.toActivityId}`;
}

export class RuntimeActivityGraph {
  private readonly snapshotRecord: RuntimeActivityGraphSnapshot;
  private readonly activityMap = new Map<string, RuntimeActivityRecord>();
  private readonly inboundMap = new Map<string, RuntimeActivityGraphEdge[]>();
  private readonly outboundMap = new Map<string, RuntimeActivityGraphEdge[]>();
  private readonly transitionMap = new Map<string, RuntimeTransitionRecord>();

  constructor(workflow: RuntimeWorkflowRecord) {
    const duplicateActivity = workflow.activities.find((activity, index, activities) =>
      activities.findIndex((entry) => entry.activityId === activity.activityId) !== index);
    if (duplicateActivity) {
      throw new Error(`GRT-WF-GRAPH-001: Duplicate activity: ${duplicateActivity.activityId}`);
    }

    for (const activity of workflow.activities) {
      this.activityMap.set(activity.activityId, activity);
      this.inboundMap.set(activity.activityId, []);
      this.outboundMap.set(activity.activityId, []);
    }

    for (const transition of workflow.transitions) {
      if (!this.activityMap.has(transition.fromActivityId) || !this.activityMap.has(transition.toActivityId)) {
        throw new Error(`GRT-WF-GRAPH-002: Invalid transition reference: ${transition.transitionId}`);
      }
      this.transitionMap.set(transition.transitionId, transition);
      const edge = deepFreeze({
        fromActivityId: transition.fromActivityId,
        transitionId: transition.transitionId,
        toActivityId: transition.toActivityId,
      });
      this.outboundMap.get(edge.fromActivityId)?.push(edge);
      this.inboundMap.get(edge.toActivityId)?.push(edge);
    }

    for (const activity of workflow.activities) {
      for (const transitionId of activity.transitionIds) {
        if (!this.transitionMap.has(transitionId)) {
          throw new Error(`GRT-WF-GRAPH-003: Missing transition for activity ${activity.activityId}: ${transitionId}`);
        }
      }
    }

    for (const waitingDefinition of workflow.waitingDefinitions) {
      if (!this.activityMap.has(waitingDefinition.activityId)) {
        throw new Error(`GRT-WF-GRAPH-004: Missing activity for waiting definition ${waitingDefinition.waitingDefinitionId}`);
      }
    }

    for (const compensationDefinition of workflow.compensationDefinitions) {
      if (!this.activityMap.has(compensationDefinition.activityId) || !this.activityMap.has(compensationDefinition.compensationActivityId)) {
        throw new Error(`GRT-WF-GRAPH-005: Invalid compensation definition ${compensationDefinition.compensationDefinitionId}`);
      }
    }

    for (const entryActivityId of workflow.entryActivityIds) {
      if (!this.activityMap.has(entryActivityId)) {
        throw new Error(`GRT-WF-GRAPH-006: Missing entry activity ${entryActivityId}`);
      }
    }

    for (const exitActivityId of workflow.exitActivityIds) {
      if (!this.activityMap.has(exitActivityId)) {
        throw new Error(`GRT-WF-GRAPH-007: Missing exit activity ${exitActivityId}`);
      }
    }

    this.assertReachable(workflow);
    this.assertAcyclic(workflow.workflowId);

    const edges = Object.freeze(
      [...this.transitionMap.values()]
        .map((transition) => deepFreeze({ fromActivityId: transition.fromActivityId, transitionId: transition.transitionId, toActivityId: transition.toActivityId }))
        .sort((a, b) => edgeKey(a).localeCompare(edgeKey(b))),
    );

    this.snapshotRecord = deepFreeze({
      workflowId: workflow.workflowId,
      activities: Object.freeze([...workflow.activities].sort((a, b) => a.activityId.localeCompare(b.activityId))),
      edges,
      entryActivityIds: stableStringArray(workflow.entryActivityIds),
      exitActivityIds: stableStringArray(workflow.exitActivityIds),
      waitingActivityIds: Object.freeze(
        [...new Set(workflow.waitingDefinitions.map((definition) => definition.activityId))].sort((a, b) => a.localeCompare(b)),
      ),
      compensationActivityIds: Object.freeze(
        [...new Set(workflow.compensationDefinitions.map((definition) => definition.compensationActivityId))].sort((a, b) => a.localeCompare(b)),
      ),
    });
  }

  snapshot(): RuntimeActivityGraphSnapshot {
    return this.snapshotRecord;
  }

  activity(activityId: string): RuntimeActivityRecord {
    const activity = this.activityMap.get(activityId);
    if (!activity) {
      throw new Error(`GRT-WF-GRAPH-008: Unknown activity: ${activityId}`);
    }
    return activity;
  }

  transitionsFrom(activityId: string): readonly RuntimeTransitionRecord[] {
    return Object.freeze(
      (this.outboundMap.get(activityId) ?? [])
        .map((edge) => this.transitionMap.get(edge.transitionId))
        .filter((entry): entry is RuntimeTransitionRecord => Boolean(entry))
        .sort((a, b) =>
          (a.priority - b.priority)
          || a.transitionId.localeCompare(b.transitionId)
          || a.fromActivityId.localeCompare(b.fromActivityId)
          || a.toActivityId.localeCompare(b.toActivityId)),
    );
  }

  inbound(activityId: string): readonly RuntimeActivityGraphEdge[] {
    return Object.freeze([...(this.inboundMap.get(activityId) ?? [])].sort((a, b) => edgeKey(a).localeCompare(edgeKey(b))));
  }

  eligibleActivities(instance: RuntimeWorkflowInstanceRecord): readonly RuntimeActivityRecord[] {
    const blocked = new Set([
      ...instance.activeActivityIds,
      ...instance.completedActivityIds,
      ...instance.failedActivityIds,
      ...this.waitingActivities(instance.waitingStateIds),
    ]);

    return Object.freeze(
      this.snapshotRecord.activities.filter((activity) => {
        if (blocked.has(activity.activityId)) {
          return false;
        }
        const inbound = this.inbound(activity.activityId);
        if (inbound.length === 0) {
          return this.snapshotRecord.entryActivityIds.includes(activity.activityId);
        }
        return inbound.every((edge) => instance.completedActivityIds.includes(edge.fromActivityId));
      }),
    );
  }

  private waitingActivities(waitingStateIds: readonly string[]): readonly string[] {
    return Object.freeze(
      this.snapshotRecord.activities
        .filter((activity) => waitingStateIds.some((waitingStateId) => waitingStateId.includes(activity.activityId)))
        .map((activity) => activity.activityId),
    );
  }

  private assertReachable(workflow: RuntimeWorkflowRecord): void {
    const visited = new Set<string>();
    const queue = [...workflow.entryActivityIds];
    const compensationActivityIds = new Set<string>([
      ...workflow.activities
        .map((activity) => activity.compensationActivityId)
        .filter((activityId): activityId is string => Boolean(activityId)),
      ...workflow.compensationDefinitions.map((definition) => definition.compensationActivityId),
    ]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) {
        continue;
      }
      visited.add(current);
      for (const edge of this.outboundMap.get(current) ?? []) {
        queue.push(edge.toActivityId);
      }
    }

    const unreachable = workflow.activities
      .map((activity) => activity.activityId)
      .filter((activityId) => !visited.has(activityId) && !compensationActivityIds.has(activityId));
    if (unreachable.length > 0) {
      throw new Error(`GRT-WF-GRAPH-009: Unreachable activities: ${unreachable.join(",")}`);
    }
  }

  private assertAcyclic(workflowId: string): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (activityId: string): boolean => {
      if (stack.has(activityId)) {
        return true;
      }
      if (visited.has(activityId)) {
        return false;
      }
      visited.add(activityId);
      stack.add(activityId);
      for (const edge of this.outboundMap.get(activityId) ?? []) {
        if (visit(edge.toActivityId)) {
          return true;
        }
      }
      stack.delete(activityId);
      return false;
    };

    for (const activity of this.snapshotRecord?.activities ?? this.activityMap.values()) {
      if (visit(activity.activityId)) {
        throw new Error(`GRT-WF-GRAPH-010: Prohibited cycle detected in workflow ${workflowId}`);
      }
    }
  }
}
