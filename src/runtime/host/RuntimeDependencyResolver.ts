import type { RuntimeContextSnapshot } from "../kernel";

export interface RuntimeDependencyResolution {
  dependencyBindingIds: readonly string[];
  contracts: readonly string[];
  externalProviderCount: number;
}

export class RuntimeDependencyResolver {
  resolve(context: RuntimeContextSnapshot): RuntimeDependencyResolution {
    const container = context.dependencyContainer;
    const ids = Object.keys(container).sort((a, b) => a.localeCompare(b));
    const contracts = [...new Set(ids.map((id) => container[id].contract))].sort((a, b) => a.localeCompare(b));
    const externalProviderCount = ids.filter((id) => container[id].external).length;

    return Object.freeze({
      dependencyBindingIds: ids,
      contracts,
      externalProviderCount,
    });
  }
}
