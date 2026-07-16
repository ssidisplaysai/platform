import type { RuntimeWorkflowDiagnostic, RuntimeWorkflowLogLevel } from "./types";
import { deepFreeze } from "./types";

export class RuntimeWorkflowDiagnostics {
  private sequence = 1;
  private readonly entries: RuntimeWorkflowDiagnostic[] = [];

  log(
    runtimeInstanceId: string,
    level: RuntimeWorkflowLogLevel,
    code: string,
    message: string,
    refs: {
      workflowId?: string;
      workflowInstanceId?: string;
      activityId?: string;
      waitingStateId?: string;
    } = {},
    details?: Readonly<Record<string, unknown>>,
  ): RuntimeWorkflowDiagnostic {
    const entry = deepFreeze({
      sequence: this.sequence++,
      runtimeInstanceId,
      level,
      code,
      message,
      workflowId: refs.workflowId,
      workflowInstanceId: refs.workflowInstanceId,
      activityId: refs.activityId,
      waitingStateId: refs.waitingStateId,
      details,
    });
    this.entries.push(entry);
    return entry;
  }

  all(): readonly RuntimeWorkflowDiagnostic[] {
    return Object.freeze([...this.entries]);
  }
}
