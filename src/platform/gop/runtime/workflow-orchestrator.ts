import type { GenesisExecutionGraph, GenesisExecutionNode, GenesisExecutionNodeType } from "../contracts";

export type GenesisWorkflowStep = {
  stepId: string;
  label: string;
  nodeType: GenesisExecutionNodeType;
  timeoutMs?: number;
  retryLimit?: number;
};

export function buildSequentialWorkflowGraph(graphId: string, steps: GenesisWorkflowStep[]): GenesisExecutionGraph {
  const nodes: GenesisExecutionNode[] = steps.map((step, index) => ({
    nodeId: step.stepId,
    label: step.label,
    nodeType: step.nodeType,
    dependsOn: index > 0 ? [steps[index - 1].stepId] : [],
    timeoutMs: step.timeoutMs,
    retryLimit: step.retryLimit,
  }));

  const edges = steps.slice(1).map((step, index) => ({
    edgeId: `${graphId}:${steps[index].stepId}:${step.stepId}`,
    fromNodeId: steps[index].stepId,
    toNodeId: step.stepId,
  }));

  return {
    graphId,
    nodes,
    edges,
  };
}

export function buildParallelWorkflowGraph(graphId: string, input: {
  root: GenesisWorkflowStep;
  branches: GenesisWorkflowStep[];
  join: GenesisWorkflowStep;
}): GenesisExecutionGraph {
  const nodes: GenesisExecutionNode[] = [
    {
      nodeId: input.root.stepId,
      label: input.root.label,
      nodeType: input.root.nodeType,
      dependsOn: [],
      timeoutMs: input.root.timeoutMs,
      retryLimit: input.root.retryLimit,
    },
    ...input.branches.map((branch) => ({
      nodeId: branch.stepId,
      label: branch.label,
      nodeType: branch.nodeType,
      dependsOn: [input.root.stepId],
      timeoutMs: branch.timeoutMs,
      retryLimit: branch.retryLimit,
    })),
    {
      nodeId: input.join.stepId,
      label: input.join.label,
      nodeType: input.join.nodeType,
      dependsOn: input.branches.map((branch) => branch.stepId),
      timeoutMs: input.join.timeoutMs,
      retryLimit: input.join.retryLimit,
    },
  ];

  const edges = [
    ...input.branches.map((branch) => ({
      edgeId: `${graphId}:${input.root.stepId}:${branch.stepId}`,
      fromNodeId: input.root.stepId,
      toNodeId: branch.stepId,
    })),
    ...input.branches.map((branch) => ({
      edgeId: `${graphId}:${branch.stepId}:${input.join.stepId}`,
      fromNodeId: branch.stepId,
      toNodeId: input.join.stepId,
    })),
  ];

  return {
    graphId,
    nodes,
    edges,
  };
}

export function expandFanOutGraph(graph: GenesisExecutionGraph, fanOutNodeId: string, targets: GenesisWorkflowStep[]): GenesisExecutionGraph {
  const existing = graph.nodes.find((node) => node.nodeId === fanOutNodeId);
  if (!existing) {
    return graph;
  }

  const fanNodes = targets.map((target) => ({
    nodeId: target.stepId,
    label: target.label,
    nodeType: target.nodeType,
    dependsOn: [fanOutNodeId],
    timeoutMs: target.timeoutMs,
    retryLimit: target.retryLimit,
  }));

  const fanEdges = fanNodes.map((target) => ({
    edgeId: `${graph.graphId}:${fanOutNodeId}:${target.nodeId}`,
    fromNodeId: fanOutNodeId,
    toNodeId: target.nodeId,
  }));

  return {
    ...graph,
    nodes: [...graph.nodes, ...fanNodes],
    edges: [...graph.edges, ...fanEdges],
  };
}

export function evaluateReadyNodes(graph: GenesisExecutionGraph, completedNodeIds: string[]): GenesisExecutionNode[] {
  const completed = new Set(completedNodeIds);

  return graph.nodes.filter((node) => {
    if (completed.has(node.nodeId)) {
      return false;
    }

    return node.dependsOn.every((dependency) => completed.has(dependency));
  });
}

export function chooseBranch(condition: boolean, whenTrueNodeId: string, whenFalseNodeId: string): string {
  return condition ? whenTrueNodeId : whenFalseNodeId;
}
