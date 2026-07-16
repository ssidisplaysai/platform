import { RuntimeServiceDependencyGraph } from "./RuntimeServiceDependencyGraph";
import type { RuntimeServiceRegistry } from "./RuntimeServiceRegistry";
import type { RuntimeServiceDependencySnapshot } from "./types";

export class RuntimeServiceResolver {
  private readonly graph = new RuntimeServiceDependencyGraph();

  resolve(registry: RuntimeServiceRegistry): RuntimeServiceDependencySnapshot {
    const resolved = this.graph.build(registry.list());
    return Object.freeze({
      activationOrder: resolved.activationOrder,
      shutdownOrder: resolved.shutdownOrder,
      edges: resolved.edges,
    });
  }
}
