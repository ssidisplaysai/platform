import type { RuntimeServiceDescriptor } from "./types";

export interface RuntimeServiceDependencyGraphResult {
  readonly activationOrder: readonly string[];
  readonly shutdownOrder: readonly string[];
  readonly edges: readonly { from: string; to: string }[];
}

export class RuntimeServiceDependencyGraph {
  build(descriptors: readonly RuntimeServiceDescriptor[]): RuntimeServiceDependencyGraphResult {
    const nodes = descriptors.map((descriptor) => descriptor.id).sort((a, b) => a.localeCompare(b));
    const descriptorMap = new Map(descriptors.map((descriptor) => [descriptor.id, descriptor]));

    for (const descriptor of descriptors) {
      for (const dependency of descriptor.dependencies) {
        if (!descriptorMap.has(dependency)) {
          throw new Error(`GRT-SVC-GRAPH-001: Missing dependency ${dependency} required by ${descriptor.id}`);
        }
      }
    }

    const edges = descriptors
      .flatMap((descriptor) => descriptor.dependencies.map((dependency) => ({ from: dependency, to: descriptor.id })))
      .sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`));

    const indegree = new Map<string, number>(nodes.map((node) => [node, 0]));
    for (const edge of edges) {
      indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
    }

    const queue = nodes.filter((node) => (indegree.get(node) ?? 0) === 0).sort((a, b) => a.localeCompare(b));
    const activationOrder: string[] = [];

    const outgoing = new Map<string, string[]>();
    for (const edge of edges) {
      const current = outgoing.get(edge.from) ?? [];
      outgoing.set(edge.from, [...current, edge.to].sort((a, b) => a.localeCompare(b)));
    }

    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) {
        break;
      }

      activationOrder.push(node);
      const targets = outgoing.get(node) ?? [];
      for (const target of targets) {
        indegree.set(target, (indegree.get(target) ?? 0) - 1);
        if ((indegree.get(target) ?? 0) === 0) {
          queue.push(target);
          queue.sort((a, b) => a.localeCompare(b));
        }
      }
    }

    if (activationOrder.length !== nodes.length) {
      throw new Error("GRT-SVC-GRAPH-002: Dependency cycle detected");
    }

    return Object.freeze({
      activationOrder: Object.freeze(activationOrder),
      shutdownOrder: Object.freeze([...activationOrder].reverse()),
      edges: Object.freeze(edges),
    });
  }
}
