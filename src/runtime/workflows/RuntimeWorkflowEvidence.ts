import type { RuntimeWorkflowEvidenceEntry } from "./types";
import { deepFreeze } from "./types";

export class RuntimeWorkflowEvidence {
  private sequence = 1;
  private readonly entries: RuntimeWorkflowEvidenceEntry[] = [];

  append(
    runtimeInstanceId: string,
    type: RuntimeWorkflowEvidenceEntry["type"],
    details: Readonly<Record<string, unknown>>,
    refs: {
      workflowId?: string;
      workflowInstanceId?: string;
      activityId?: string;
      waitingStateId?: string;
      intentId?: string;
      planId?: string;
    } = {},
  ): RuntimeWorkflowEvidenceEntry {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      workflowId: refs.workflowId,
      workflowInstanceId: refs.workflowInstanceId,
      activityId: refs.activityId,
      waitingStateId: refs.waitingStateId,
      intentId: refs.intentId,
      planId: refs.planId,
      type,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeWorkflowEvidenceEntry[] {
    return Object.freeze([...this.entries]);
  }
}
