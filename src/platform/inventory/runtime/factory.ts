import {
  LifecycleStopError,
  ObserverRegistry,
  RuntimeHost,
  compareDeterministicStrings,
} from "../../shared";
import type {
  InventoryIntegrationAdapter,
  InventoryReferenceValidatorRegistrationPoint,
  InventoryRuntimeDependencies,
  InventoryRuntimeObservation,
} from "../integration";
import { InventoryRuntimeError } from "./errors";
import type {
  InventoryLifecycleAdapter,
  InventoryRuntime,
  InventoryRuntimeContext,
  InventoryRuntimeOptions,
  InventoryRuntimeServiceRegistration,
  InventoryRuntimeState,
} from "./types";

const PLATFORM_IDENTIFIER = "platform.inventory" as const;
const DEFAULT_RUNTIME_ID = "inventory-runtime";

const REQUIRED_PROVIDER_IDS = [
  "inventory.runtime.clock",
  "inventory.runtime.identifier",
  "inventory.runtime.tenant-context",
  "inventory.runtime.metadata",
  "inventory.runtime.audit-sink",
  "inventory.runtime.observation-sink",
] as const;

function createInitialState(runtimeId: string): InventoryRuntimeState {
  return {
    runtimeId,
    phase: "CREATED",
    ready: false,
    trace: [],
    providerIds: [],
    serviceIds: [],
    referenceValidatorRegistrationPointIds: [],
  };
}

function cloneState(state: InventoryRuntimeState): InventoryRuntimeState {
  return {
    ...state,
    trace: [...state.trace],
    providerIds: [...state.providerIds],
    serviceIds: [...state.serviceIds],
    referenceValidatorRegistrationPointIds: [...state.referenceValidatorRegistrationPointIds],
  };
}

function validateOptions(options: InventoryRuntimeOptions): void {
  if (!options || typeof options !== "object") {
    throw new InventoryRuntimeError("INVALID_OPTIONS", "inventory runtime options are required", false);
  }

  const dependencies = options.dependencies;
  if (!dependencies) {
    throw new InventoryRuntimeError("INVALID_OPTIONS", "inventory runtime dependencies are required", false);
  }

  const required: Array<keyof InventoryRuntimeDependencies> = [
    "clockProvider",
    "identifierProvider",
    "tenantContextProvider",
    "metadataProvider",
    "auditSinkProvider",
    "observationSinkProvider",
  ];

  for (const key of required) {
    if (!dependencies[key]) {
      throw new InventoryRuntimeError("MISSING_REQUIRED_PROVIDER", `missing required provider: ${key}`, false);
    }
  }
}

function createRuntimeObservation(state: InventoryRuntimeState): InventoryRuntimeObservation {
  return {
    capability: "platform.inventory.runtime",
    runtimeId: state.runtimeId,
    phase: state.phase,
    ready: state.ready,
    generatedAt: state.initializedAt ?? new Date().toISOString(),
    providers: [...state.providerIds],
    services: [...state.serviceIds],
  };
}

function createRuntimeServices(dependencies: InventoryRuntimeDependencies): InventoryRuntimeServiceRegistration[] {
  return [
    {
      serviceId: "inventory.runtime.audit-sink",
      contract: "inventory.runtime.audit-sink",
      description: "Mechanical audit sink contract for runtime composition.",
      value: dependencies.auditSinkProvider,
    },
    {
      serviceId: "inventory.runtime.clock-provider",
      contract: "inventory.runtime.clock-provider",
      description: "Mechanical clock provider contract for runtime composition.",
      value: dependencies.clockProvider,
    },
    {
      serviceId: "inventory.runtime.dependencies",
      contract: "inventory.runtime.dependencies",
      description: "Dependency container token for future Inventory composition.",
      value: dependencies,
    },
    {
      serviceId: "inventory.runtime.identifier-provider",
      contract: "inventory.runtime.identifier-provider",
      description: "Mechanical identifier provider contract for runtime composition.",
      value: dependencies.identifierProvider,
    },
    {
      serviceId: "inventory.runtime.metadata",
      contract: "inventory.runtime.metadata",
      description: "Inventory runtime metadata token.",
      value: dependencies.metadataProvider.getRuntimeMetadata(),
    },
    {
      serviceId: "inventory.runtime.observation-sink",
      contract: "inventory.runtime.observation-sink",
      description: "Mechanical observation sink contract for runtime composition.",
      value: dependencies.observationSinkProvider,
    },
    {
      serviceId: "inventory.runtime.platform-identifier",
      contract: "inventory.runtime.platform-identifier",
      description: "Stable platform identifier token for runtime composition.",
      value: PLATFORM_IDENTIFIER,
    },
    {
      serviceId: "inventory.runtime.tenant-context-provider",
      contract: "inventory.runtime.tenant-context-provider",
      description: "Mechanical tenant context provider contract for runtime composition.",
      value: dependencies.tenantContextProvider,
    },
  ].sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId));
}

function recordFailure(
  host: RuntimeHost<InventoryRuntimeState, InventoryRuntimeServiceRegistration>,
  dependencies: InventoryRuntimeDependencies,
  code: ConstructorParameters<typeof InventoryRuntimeError>[0],
  message: string,
): void {
  const next = cloneState(host.getState());
  next.phase = "FAILED";
  next.ready = false;
  next.lastFailure = {
    code,
    message,
    occurredAt: dependencies.clockProvider.now(),
  };
  next.trace = [...next.trace, `failure:${code}`];
  host.setState(next);
}

function appendTrace(
  host: RuntimeHost<InventoryRuntimeState, InventoryRuntimeServiceRegistration>,
  step: string,
  patch?: Partial<InventoryRuntimeState>,
): void {
  const next = cloneState(host.getState());
  next.trace = [...next.trace, step];
  host.setState({ ...next, ...patch });
}

function buildRuntime(options: InventoryRuntimeOptions): InventoryRuntime {
  validateOptions(options);

  const runtimeId = options.runtimeId?.trim() || DEFAULT_RUNTIME_ID;
  const host = new RuntimeHost<InventoryRuntimeState, InventoryRuntimeServiceRegistration>({
    runtimeId,
    initialState: createInitialState(runtimeId),
  });
  const observers = new ObserverRegistry<InventoryRuntimeObservation>();
  const registeredReferenceValidatorRegistrationPoints = new Map<string, InventoryReferenceValidatorRegistrationPoint>();
  const dependencies = options.dependencies;

  const context: InventoryRuntimeContext = {
    host,
    lifecycle: host.lifecycle,
    providers: host.providers,
    services: host.services,
    observers,
    dependencies,
    registerReferenceValidatorRegistrationPoint(point) {
      if (!point.registrationPointId || registeredReferenceValidatorRegistrationPoints.has(point.registrationPointId)) {
        throw new InventoryRuntimeError(
          "INTEGRATION_REGISTRATION_FAILURE",
          `reference validator registration point conflict: ${point.registrationPointId}`,
          false,
          host.snapshot(),
        );
      }
      registeredReferenceValidatorRegistrationPoints.set(point.registrationPointId, point);
      const next = cloneState(host.getState());
      next.referenceValidatorRegistrationPointIds = [...registeredReferenceValidatorRegistrationPoints.keys()].sort(
        compareDeterministicStrings,
      );
      host.setState(next);
    },
  };

  const runtime: InventoryRuntime = {
    host,
    dependencies,
    observers,
    lifecycle: host.lifecycle,
    providers: host.providers,
    services: host.services,
    snapshot() {
      return host.snapshot();
    },
    isReady() {
      return host.getState().ready;
    },
    async start() {
      const current = host.getState();
      if (current.phase === "READY") {
        throw new InventoryRuntimeError("INVALID_RUNTIME_STATE_TRANSITION", "inventory runtime is already ready", false, host.snapshot());
      }
      if (current.phase === "STOPPING") {
        throw new InventoryRuntimeError(
          "INVALID_RUNTIME_STATE_TRANSITION",
          "inventory runtime cannot start while stopping",
          false,
          host.snapshot(),
        );
      }

      const startingState = cloneState(host.getState());
      startingState.phase = "INITIALIZING";
      startingState.ready = false;
      host.setState(startingState);

      try {
        await host.start();
      } catch (error) {
        if (!host.getState().lastFailure) {
          const message = error instanceof Error ? error.message : "lifecycle start failed";
          recordFailure(host, dependencies, "LIFECYCLE_START_FAILURE", message);
        }
        const state = host.getState();
        throw new InventoryRuntimeError(
          state.lastFailure?.code ?? "LIFECYCLE_START_FAILURE",
          state.lastFailure?.message ?? "inventory runtime startup failed",
          false,
          host.snapshot(),
        );
      }

      const readyState = cloneState(host.getState());
      readyState.phase = "READY";
      readyState.ready = true;
      readyState.initializedAt = dependencies.clockProvider.now();
      readyState.trace = [...readyState.trace, "10.mark-runtime-ready"];
      host.setState(readyState);
      await dependencies.observationSinkProvider.publishObservation(createRuntimeObservation(readyState));
    },
    async stop() {
      const current = cloneState(host.getState());
      current.phase = "STOPPING";
      current.ready = false;
      current.trace = [...current.trace, "shutdown:01.transition-runtime-to-stopping"];
      host.setState(current);

      try {
        await host.stop();
      } catch (error) {
        if (error instanceof LifecycleStopError) {
          recordFailure(host, dependencies, "LIFECYCLE_STOP_FAILURE", error.message);
          throw error;
        }
        recordFailure(host, dependencies, "LIFECYCLE_STOP_FAILURE", error instanceof Error ? error.message : "lifecycle stop failed");
        throw error;
      }

      const stoppedState = cloneState(host.getState());
      stoppedState.phase = "STOPPED";
      stoppedState.ready = false;
      stoppedState.stoppedAt = dependencies.clockProvider.now();
      stoppedState.trace = [...stoppedState.trace, "shutdown:05.transition-runtime-to-stopped"];
      host.setState(stoppedState);
      await dependencies.observationSinkProvider.publishObservation(createRuntimeObservation(stoppedState));
    },
  };

  const providerHooks = options.providerRegistrationHooks ?? [];
  const serviceHooks = options.serviceRegistrationHooks ?? [];
  const lifecycleAdapters = options.lifecycleAdapters ?? [];
  const integrationAdapters = options.integrationAdapters ?? [];

  for (const lifecycleAdapter of [...lifecycleAdapters].sort((left, right) => compareDeterministicStrings(left.adapterId, right.adapterId))) {
    lifecycleAdapter.register(context);
  }

  host.lifecycle.onBeforeStart("01.register-dependency-container", async () => {
    appendTrace(host, "01.register-dependency-container");
    try {
      host.registerService({
        serviceId: "inventory.runtime.dependencies",
        contract: "inventory.runtime.dependencies",
        description: "Dependency container token for future Inventory composition.",
        value: dependencies,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "dependency container registration failed";
      recordFailure(host, dependencies, "DUPLICATE_SERVICE_REGISTRATION", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("02.register-provider-registry", async () => {
    appendTrace(host, "02.register-provider-registry");
    const providers = [
      dependencies.auditSinkProvider,
      dependencies.clockProvider,
      dependencies.identifierProvider,
      dependencies.metadataProvider,
      dependencies.observationSinkProvider,
      dependencies.tenantContextProvider,
    ].sort((left, right) => compareDeterministicStrings(left.providerId, right.providerId));

    try {
      for (const provider of providers) {
        host.registerProvider(provider);
      }
      for (const hook of providerHooks) {
        hook(context);
      }
      const next = cloneState(host.getState());
      next.providerIds = host.providers.listProviders().map((provider) => provider.providerId);
      host.setState(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "provider registration failed";
      recordFailure(
        host,
        dependencies,
        message.includes("registration conflict") ? "DUPLICATE_PROVIDER" : "MISSING_REQUIRED_PROVIDER",
        message,
      );
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("03.register-service-registry", async () => {
    appendTrace(host, "03.register-service-registry");
    try {
      for (const service of createRuntimeServices(dependencies)) {
        if (service.serviceId === "inventory.runtime.dependencies") {
          continue;
        }
        host.registerService(service);
      }
      for (const hook of serviceHooks) {
        hook(context);
      }
      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "service registration failed";
      recordFailure(host, dependencies, "DUPLICATE_SERVICE_REGISTRATION", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("04.register-bounded-integration-adapters", async () => {
    appendTrace(host, "04.register-bounded-integration-adapters");
    try {
      for (const adapter of [...integrationAdapters].sort((left, right) => compareDeterministicStrings(left.adapterId, right.adapterId))) {
        await adapter.register(context);
        if (adapter.dispose) {
          host.lifecycle.onStop(`90.dispose.${adapter.adapterId}`, async () => {
            appendTrace(host, `shutdown:dispose:${adapter.adapterId}`);
            await adapter.dispose?.();
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "integration registration failed";
      recordFailure(host, dependencies, "INTEGRATION_REGISTRATION_FAILURE", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("05.validate-required-registrations", async () => {
    appendTrace(host, "05.validate-required-registrations");
    const providers = host.providers.listProviders();
    const capabilities = new Set(providers.map((provider) => provider.capability));

    for (const capability of REQUIRED_PROVIDER_IDS) {
      if (!capabilities.has(capability)) {
        const message = `missing required provider capability: ${capability}`;
        recordFailure(host, dependencies, "MISSING_REQUIRED_PROVIDER", message);
        throw new Error(message);
      }
    }

    const requiredServices = new Set(
      createRuntimeServices(dependencies).map((service) => service.serviceId),
    );
    for (const serviceId of requiredServices) {
      try {
        host.services.require(serviceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : `service not found: ${serviceId}`;
        recordFailure(host, dependencies, "PARTIAL_INITIALIZATION_REJECTION", message);
        throw error;
      }
    }
  });

  host.lifecycle.onStart("06.start-shared-runtime-lifecycle", async () => {
    appendTrace(host, "09.start-shared-runtime-lifecycle");
  });

  host.lifecycle.onStop("10.dispose-observers", async () => {
    appendTrace(host, "shutdown:03.dispose-bounded-runtime-resources");
  });

  return runtime;
}

let singleton: InventoryRuntime | null = null;
let singletonInitialization: Promise<InventoryRuntime> | null = null;

export async function createInventoryRuntime(options: InventoryRuntimeOptions): Promise<InventoryRuntime> {
  const runtime = buildRuntime(options);
  await runtime.start();
  return runtime;
}

export async function initializeInventoryRuntime(options: InventoryRuntimeOptions): Promise<InventoryRuntime> {
  if (singleton || singletonInitialization) {
    throw new InventoryRuntimeError("DUPLICATE_INITIALIZATION", "inventory runtime has already been initialized", false);
  }

  singletonInitialization = createInventoryRuntime(options)
    .then((runtime) => {
      singleton = runtime;
      singletonInitialization = null;
      return runtime;
    })
    .catch((error) => {
      singleton = null;
      singletonInitialization = null;
      throw error;
    });

  return singletonInitialization;
}

export function getInventoryRuntimeSingleton(): InventoryRuntime {
  if (!singleton) {
    throw new InventoryRuntimeError("INVALID_RUNTIME_STATE_TRANSITION", "inventory runtime has not been initialized", false);
  }
  return singleton;
}

export async function resetInventoryRuntimeForTests(): Promise<void> {
  const runtime = singleton;
  singleton = null;
  singletonInitialization = null;

  if (!runtime) {
    return;
  }

  const state = runtime.snapshot().state;
  if (state.phase === "READY" || state.phase === "FAILED") {
    await runtime.stop().catch((error) => {
      throw error;
    });
  }
}
