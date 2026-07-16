import type { RuntimeActivityRecord, RuntimeCompensationDefinitionRecord, RuntimeWorkflowRecord } from "./types";

export class RuntimeCompensationEngine {
  deriveActivities(
    workflow: RuntimeWorkflowRecord,
    failedActivityId: string,
  ): readonly RuntimeActivityRecord[] {
    const derivedActivityIds = new Set<string>();
    const failedActivity = workflow.activities.find((activity) => activity.activityId === failedActivityId);
    if (failedActivity?.compensationActivityId) {
      derivedActivityIds.add(failedActivity.compensationActivityId);
    }

    for (const definition of workflow.compensationDefinitions) {
      if (definition.activityId === failedActivityId) {
        derivedActivityIds.add(definition.compensationActivityId);
      }
    }

    return Object.freeze(
      workflow.activities
        .filter((activity) => derivedActivityIds.has(activity.activityId))
        .sort((a, b) => a.activityId.localeCompare(b.activityId)),
    );
  }

  deriveDefinitions(
    workflow: RuntimeWorkflowRecord,
    failedActivityId: string,
  ): readonly RuntimeCompensationDefinitionRecord[] {
    return Object.freeze(
      workflow.compensationDefinitions
        .filter((definition) => definition.activityId === failedActivityId)
        .sort((a, b) => a.compensationDefinitionId.localeCompare(b.compensationDefinitionId)),
    );
  }
}
