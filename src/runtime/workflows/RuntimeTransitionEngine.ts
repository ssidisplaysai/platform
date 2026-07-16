import type {
  RuntimeActivityGraphSnapshot,
  RuntimeTransitionApplication,
  RuntimeTransitionGuardDescriptor,
  RuntimeTransitionRecord,
  RuntimeWorkflowObservation,
} from "./types";
import { observationMessageType } from "./types";

function guardSatisfied(
  guard: RuntimeTransitionGuardDescriptor | undefined,
  observation?: RuntimeWorkflowObservation,
): boolean {
  if (!guard || guard.type === "always") {
    return true;
  }
  if (!observation) {
    return false;
  }
  switch (guard.type) {
    case "payloadEquals":
      return observation.payload?.[guard.key ?? ""] === guard.value;
    case "metadataEquals":
      return observation.metadata[guard.key ?? ""] === guard.value;
    case "correlationEquals":
      return observation.correlationId === guard.value;
    case "causationEquals":
      return observation.causationId === guard.value;
    default:
      return false;
  }
}

function observationMatches(transition: RuntimeTransitionRecord, observation?: RuntimeWorkflowObservation): boolean {
  if (!observation) {
    return transition.triggerType === "ActivityCompleted" || transition.triggerType === "ActivityFailed" || transition.triggerType === "CompensationCompleted";
  }
  if (transition.triggerType !== observation.triggerType) {
    return false;
  }
  if (transition.expectedEnvelopeType && transition.expectedEnvelopeType !== observation.envelopeType) {
    return false;
  }
  if (transition.expectedChannel && transition.expectedChannel !== observation.channel) {
    return false;
  }
  if (transition.expectedTopic && transition.expectedTopic !== observation.topic) {
    return false;
  }
  if (transition.expectedMessageType && transition.expectedMessageType !== observationMessageType(observation)) {
    return false;
  }
  return true;
}

export class RuntimeTransitionEngine {
  orderTransitions(transitions: readonly RuntimeTransitionRecord[]): readonly RuntimeTransitionRecord[] {
    return Object.freeze([
      ...transitions,
    ].sort((a, b) =>
      (a.priority - b.priority)
      || a.transitionId.localeCompare(b.transitionId)
      || a.fromActivityId.localeCompare(b.fromActivityId)
      || a.toActivityId.localeCompare(b.toActivityId)));
  }

  evaluate(
    graph: RuntimeActivityGraphSnapshot,
    activityId: string,
    transitions: readonly RuntimeTransitionRecord[],
    observation?: RuntimeWorkflowObservation,
  ): RuntimeTransitionApplication {
    const applicable = this.orderTransitions(
      transitions.filter((transition) =>
        transition.fromActivityId === activityId
        && observationMatches(transition, observation)
        && guardSatisfied(transition.guardDescriptor, observation)),
    );

    const nextActivityIds = Object.freeze(
      applicable
        .map((transition) => transition.toActivityId)
        .filter((targetActivityId, index, values) => values.indexOf(targetActivityId) === index)
        .filter((targetActivityId) => graph.activities.some((activity) => activity.activityId === targetActivityId)),
    );

    return Object.freeze({
      activityId,
      transitionIds: Object.freeze(applicable.map((transition) => transition.transitionId)),
      nextActivityIds,
    });
  }
}
