import { compareDeterministicStrings } from "../../shared/utilities";
import type { ExecutionRouting, RoutingStep, RoutingStepId } from "../contracts";
import { ManufacturingDomainError } from "./errors";

type EdgeType = "STRUCTURAL" | "REWORK" | "CONDITIONAL";

type RoutingEdge = Readonly<{
  from: RoutingStepId;
  to: RoutingStepId;
  edgeType: EdgeType;
}>;

export type RoutingValidationResult = Readonly<{
  orderedStepIds: readonly RoutingStepId[];
  structuralEdges: readonly RoutingEdge[];
  reworkEdges: readonly RoutingEdge[];
}>;

function compareStep(left: RoutingStep, right: RoutingStep): number {
  if (left.sequenceNumber !== right.sequenceNumber) {
    return left.sequenceNumber < right.sequenceNumber ? -1 : 1;
  }
  return compareDeterministicStrings(left.routingStepId, right.routingStepId);
}

function assertNoDuplicateStepIds(steps: readonly RoutingStep[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (seen.has(step.routingStepId)) {
      throw new ManufacturingDomainError("DUPLICATE_ROUTING_STEP_ID", `duplicate routing step id: ${step.routingStepId}`, false);
    }
    seen.add(step.routingStepId);
  }
}

function assertUniqueOperationIdentities(steps: readonly RoutingStep[]): void {
  const operationExecutionIds = new Set<string>();
  const operationCodes = new Set<string>();

  for (const step of steps) {
    if (step.operationExecutionId && operationExecutionIds.has(step.operationExecutionId)) {
      throw new ManufacturingDomainError(
        "DUPLICATE_OPERATION_EXECUTION_ID",
        `duplicate operation execution id in routing steps: ${step.operationExecutionId}`,
        false,
      );
    }
    if (step.operationExecutionId) {
      operationExecutionIds.add(step.operationExecutionId);
    }

    if (step.operationCode && operationCodes.has(step.operationCode)) {
      throw new ManufacturingDomainError(
        "DUPLICATE_OPERATION_EXECUTION_ID",
        `duplicate operation code in routing steps: ${step.operationCode}`,
        false,
      );
    }
    if (step.operationCode) {
      operationCodes.add(step.operationCode);
    }
  }
}

function assertValidReferencedStepIds(steps: readonly RoutingStep[]): void {
  const allStepIds = new Set(steps.map((step) => step.routingStepId));

  for (const step of steps) {
    const references: Array<{ id: RoutingStepId; relation: string }> = [];
    references.push(...step.predecessorStepIds.map((id) => ({ id, relation: "predecessor" })));
    references.push(...step.successorStepIds.map((id) => ({ id, relation: "successor" })));
    references.push(...step.conditionalStepIds.map((id) => ({ id, relation: "conditional" })));
    references.push(...step.reworkStepIds.map((id) => ({ id, relation: "rework" })));
    references.push(...(step.explicitReworkEdges ?? []).map((edge) => ({ id: edge.targetStepId, relation: "rework" })));

    for (const reference of references) {
      if (!allStepIds.has(reference.id)) {
        throw new ManufacturingDomainError(
          "INVALID_ROUTING_DEPENDENCY",
          `routing step ${step.routingStepId} references unknown ${reference.relation} step ${reference.id}`,
          false,
        );
      }
      if (reference.id === step.routingStepId) {
        throw new ManufacturingDomainError(
          "ROUTING_SELF_CYCLE",
          `routing step ${step.routingStepId} cannot self-reference`,
          false,
        );
      }
    }
  }
}

function createStructuralAdjacency(steps: readonly RoutingStep[]): Map<RoutingStepId, Set<RoutingStepId>> {
  const adjacency = new Map<RoutingStepId, Set<RoutingStepId>>();

  for (const step of steps) {
    adjacency.set(step.routingStepId, new Set());
  }

  for (const step of steps) {
    for (const successorId of step.successorStepIds) {
      adjacency.get(step.routingStepId)?.add(successorId);
    }
    for (const conditionalId of step.conditionalStepIds) {
      adjacency.get(step.routingStepId)?.add(conditionalId);
    }
    for (const predecessorId of step.predecessorStepIds) {
      adjacency.get(predecessorId)?.add(step.routingStepId);
    }
  }

  return adjacency;
}

function findStructuralCycle(adjacency: Map<RoutingStepId, Set<RoutingStepId>>): RoutingStepId[] | null {
  const visiting = new Set<RoutingStepId>();
  const visited = new Set<RoutingStepId>();
  const path: RoutingStepId[] = [];

  const dfs = (node: RoutingStepId): RoutingStepId[] | null => {
    if (visiting.has(node)) {
      const startIndex = path.indexOf(node);
      return [...path.slice(startIndex), node];
    }
    if (visited.has(node)) {
      return null;
    }

    visiting.add(node);
    path.push(node);

    const neighbors = [...(adjacency.get(node) ?? [])].sort((left, right) => compareDeterministicStrings(left, right));
    for (const neighbor of neighbors) {
      const cycle = dfs(neighbor);
      if (cycle) {
        return cycle;
      }
    }

    path.pop();
    visiting.delete(node);
    visited.add(node);
    return null;
  };

  const nodes = [...adjacency.keys()].sort((left, right) => compareDeterministicStrings(left, right));
  for (const node of nodes) {
    const cycle = dfs(node);
    if (cycle) {
      return cycle;
    }
  }

  return null;
}

function topologicalSort(steps: readonly RoutingStep[], adjacency: Map<RoutingStepId, Set<RoutingStepId>>): RoutingStepId[] {
  const indegree = new Map<RoutingStepId, number>();
  for (const step of steps) {
    indegree.set(step.routingStepId, 0);
  }

  for (const targets of adjacency.values()) {
    for (const target of targets) {
      indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }

  const stepById = new Map(steps.map((step) => [step.routingStepId, step]));
  const queue = steps
    .filter((step) => (indegree.get(step.routingStepId) ?? 0) === 0)
    .sort(compareStep)
    .map((step) => step.routingStepId);

  const ordered: RoutingStepId[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);

    const neighbors = [...(adjacency.get(current) ?? [])].sort((left, right) => compareDeterministicStrings(left, right));
    for (const neighbor of neighbors) {
      indegree.set(neighbor, (indegree.get(neighbor) ?? 0) - 1);
      if ((indegree.get(neighbor) ?? 0) === 0) {
        queue.push(neighbor);
        queue.sort((left, right) => compareStep(stepById.get(left)!, stepById.get(right)!));
      }
    }
  }

  if (ordered.length !== steps.length) {
    throw new ManufacturingDomainError("ROUTING_STRUCTURAL_CYCLE", "routing has unresolved structural cycle", false);
  }

  return ordered;
}

export function validateRoutingGraph(routing: ExecutionRouting): RoutingValidationResult {
  const steps = routing.steps;

  assertNoDuplicateStepIds(steps);
  assertUniqueOperationIdentities(steps);
  assertValidReferencedStepIds(steps);

  const adjacency = createStructuralAdjacency(steps);
  const cycle = findStructuralCycle(adjacency);
  if (cycle) {
    throw new ManufacturingDomainError(
      "ROUTING_STRUCTURAL_CYCLE",
      `invalid structural routing cycle detected: ${cycle.join(" -> ")}`,
      false,
    );
  }

  const orderedStepIds = topologicalSort(steps, adjacency);

  const structuralEdges: RoutingEdge[] = [];
  const reworkEdges: RoutingEdge[] = [];

  for (const step of steps) {
    for (const successorId of step.successorStepIds) {
      structuralEdges.push({ from: step.routingStepId, to: successorId, edgeType: "STRUCTURAL" });
    }
    for (const conditionalId of step.conditionalStepIds) {
      structuralEdges.push({ from: step.routingStepId, to: conditionalId, edgeType: "CONDITIONAL" });
    }
    const uniqueReworkTargets = new Set<RoutingStepId>();
    for (const edge of step.explicitReworkEdges ?? []) {
      uniqueReworkTargets.add(edge.targetStepId);
    }
    for (const targetStepId of step.reworkStepIds) {
      uniqueReworkTargets.add(targetStepId);
    }
    for (const targetStepId of uniqueReworkTargets) {
      const edge = { targetStepId };
      reworkEdges.push({ from: step.routingStepId, to: edge.targetStepId, edgeType: "REWORK" });
    }
  }

  return Object.freeze({
    orderedStepIds,
    structuralEdges: Object.freeze(structuralEdges),
    reworkEdges: Object.freeze(reworkEdges),
  });
}
