import { RuntimeProcess } from "./RuntimeProcess";
import type { RuntimeWorkflowRecord } from "./types";
import { deepFreeze } from "./types";

export class RuntimeWorkflow extends RuntimeProcess {
  constructor(private readonly workflowRecord: RuntimeWorkflowRecord) {
    super({
      processId: workflowRecord.workflowId,
      processType: workflowRecord.processType,
      name: workflowRecord.name,
      version: workflowRecord.version,
      schemaVersion: workflowRecord.schemaVersion,
      metadata: workflowRecord.metadata,
    });
  }

  snapshot(): RuntimeWorkflowRecord {
    return deepFreeze(this.workflowRecord);
  }
}
