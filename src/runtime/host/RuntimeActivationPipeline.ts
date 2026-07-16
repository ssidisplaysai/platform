import type { RuntimeContextSnapshot } from "../kernel";

export interface RuntimeActivationResult {
  activatedServices: readonly string[];
  loadedPlugins: readonly string[];
  initializedSecurityBindings: number;
  injectedSecrets: number;
  bootstrappedSchedules: readonly string[];
}

export class RuntimeActivationPipeline {
  activate(context: RuntimeContextSnapshot): RuntimeActivationResult {
    const activatedServices = context.serviceRegistry
      .filter((entry) => entry.kind === "service")
      .map((entry) => entry.id)
      .sort((a, b) => a.localeCompare(b));

    const loadedPlugins = context.pluginRegistry.map((entry) => entry.id).sort((a, b) => a.localeCompare(b));

    const initializedSecurityBindings = context.enterpriseRuntimeIR.enterpriseRuntime.authenticationBindings.length
      + context.enterpriseRuntimeIR.enterpriseRuntime.authorizationBindings.length;

    const injectedSecrets = context.enterpriseRuntimeIR.enterpriseRuntime.secretReferences.length;

    const bootstrappedSchedules = context.scheduler.filter((entry) => entry.startsWith("workflow:")).sort((a, b) => a.localeCompare(b));

    return Object.freeze({
      activatedServices,
      loadedPlugins,
      initializedSecurityBindings,
      injectedSecrets,
      bootstrappedSchedules,
    });
  }
}
