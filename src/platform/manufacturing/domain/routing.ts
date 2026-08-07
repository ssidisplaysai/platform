import { compareDeterministicStrings } from "../../shared/utilities";
import type { ExecutionRouting, RoutingStep, RoutingStepId } from "../contracts";
import { ManufacturingDomainError } from "./errors";

type EdgeType = "STRUCTURAL" | "REWORK" | "CONDITIONAL";

export type RoutingValidationResult = Readonly<{
  orderedStepIds: readonly RoutingStepId[];
  structuralEdges: ReadonlyArray<Readonly<{ from: RoutingStepId; to: RoutingStepId; edgeType: EdgeType }>>;
  reworkEdges: ReadonlyArray<Readonly<{ from: RoutingStepId; to: RoutingStepId; edgeType: EdgeType }>>;
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
      throw new ManufacturingDomainError("INVALID_ROUTING_STEP", `duplicate routing step id: ${step.routingStepId}`, false);
    }
    seen.add(step.routingStepId);
  }
}

function assertValidReferencedStepIds(steps: readonly RoutingStep[]): void {
  const allStepIds = new Set(steps.map((step) => step.routingStepId));
  for (const step of steps) {
    const allReferences = [
      ...step.predecessorStepIds,
      ...step.successorStepIds,
      ...step.reworkStepIds,
      ...step.conditionalStepIds,
    ];
    for (const referencedId of allReferences) {
      if (!allStepIds.has(referencedId)) {
        throw new ManufacturingDomainError(
          "INVALID_ROUTING_STEP",
          `routing step ${step.routingStepId} references unknown step ${referencedId}`,
          false,
        );
      }
      if (referencedId === step.routingStepId) {
        throw new ManufacturingDomainError(
          "INVALID_ROUTING_STEP",
          `routing step ${step.routingStepId} cannot self-reference`,
          false,
        );
      }
    }
  }
}

function structuralAdjacency(steps: readonly RoutingStep[]): Map<RoutingStepId, Set<RoutingStepId>> {
  const adjacency = new Map<RoutingStepId, Set<RoutingStepId>>();
  for (const step of steps) {
    adjacency.set(step.routingStepId, new Set(step.successorStepIds));
  }

  for (const step of steps) {
    for (const predecessorId of step.predecessorStepIds) {
      const next = adjacency.get(predecessorId);
      if (next) {
        next.add(step.routingStepId);
      }
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
      const index = path.indexOf(node);
      return [...path.slice(index), node];
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

  const sortedNodes = [...adjacency.keys()].sort((left, right) => compareDeterministicStrings(left, right));
  for (const node of sortedNodes) {
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

  for (const [, targets] of adjacency.entries()) {
    for (const target of targets) {
      indegree.set(target, (indegree.get(target) ?? 0) + 1);
    }
  }

  const queue = steps
    .filter((step) => (indegree.get(step.routingStepId) ?? 0) === 0)
    .sort(compareStep)
    .map((step) => step.routingStepId);
  const ordered: RoutingStepId[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    const next = [...(adjacency.get(current) ?? [])].sort((left, right) => compareDeterministicStrings(left, right));
    for (const target of next) {
      indegree.set(target, (indegree.get(target) ?? 0) - 1);
      if ((indegree.get(target) ?? 0) === 0) {
        queue.push(target);
        queue.sort((left, right) => {
          const leftStep = steps.find((step) => step.routingStepId === left)!;
          const rightStep = steps.find((step) => step.routingStepId === right)!;
          return compareStep(leftStep, rightStep);
        });
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
  assertValidReferencedStepIds(steps);

  const adjacency = structuralAdjacency(steps);
  const cycle = findStructuralCycle(adjacency);
  if (cycle) {
    throw new ManufacturingDomainError(
      "ROUTING_STRUCTURAL_CYCLE",
      `invalid structural routing cycle detected: ${cycle.join(" -> ")}`,
      false,
    );
  }

  const orderedStepIds = topologicalSort(steps, adjacency);

  const structuralEdges: Array<{ from: RoutingStepId; to: RoutingStepId; edgeType: EdgeType }> = [];
  const reworkEdges: Array<{ from: RoutingStepId; to: RoutingStepId; edgeType: EdgeType }> = [];

  for (const step of steps) {
    for (const to of step.successorStepIds) {
      structuralEdges.push({ from: step.routingStepId, to, edgeType: "STRUCTURAL" });
    }
    for (const to of step.conditionalStepIds) {
      structuralEdges.push({ from: step.routingStepId, to, edgeType: "CONDITIONAL" });
    }
    for (const to of step.reworkStepIds) {
      reworkEdges.push({ from: step.routingStepId, to, edgeType: "REWORK" });
    }
  }

  return Object.freeze({
    orderedStepIds,
    structuralEdges: Object.freeze(structuralEdges),
    reworkEdges: Object.freeze(reworkEdges),
  });
}
