import {
  LifecycleStopError,
  ObserverRegistry,
  RuntimeHost,
  compareDeterministicStrings,
} from "../../shared";
import type {
  ManufacturingExternalReferenceValidationPort,
  ManufacturingIntegrationRegistration,
  ManufacturingInventoryIntegrationPort,
  ManufacturingIntegrationType,
  ManufacturingProductIntegrationPort,
  ManufacturingRuntimeDependencies,
  ManufacturingRuntimeObservation,
} from "../integration";
import { ManufacturingDomainError } from "../domain";
import {
  DowntimeService,
  ExecutionExceptionService,
  ExecutionRoutingService,
  LaborAssignmentService,
  MachineAssignmentService,
  ManufacturingInventoryIntegrationService,
  ManufacturingAuditService,
  ManufacturingHealthService,
  ManufacturingMetricsService,
  ManufacturingObservationPublisher,
  ManufacturingProductReferenceService,
  ManufacturingReferenceValidationService,
  ManufacturingTraceabilityService,
  ManufacturingWorkOrderReferenceValidator,
  ManufacturingWorkOrderService,
  MaterialConsumptionService,
  MaterialIssueService,
  MaterialRequirementService,
  OperationExecutionService,
  ProductionOutputService,
  ProductionBatchService,
  ProductionRunService,
  ProductionCellService,
  ResourceReadinessService,
  ReworkService,
  ScrapService,
  ToolAssignmentService,
  WipService,
  WorkCenterService,
  YieldService,
} from "../services";
import {
  ManufacturingFoundationQueryService,
  ManufacturingMaterialExecutionQueryService,
  ManufacturingMaterialQueryService,
  ManufacturingObservabilityQueryService,
  ManufacturingProductionResultQueryService,
  ManufacturingResourceQueryService,
  ManufacturingRoutingQueryService,
  ManufacturingTraceabilityQueryService,
} from "../queries";
import { ManufacturingRuntimeError } from "./errors";
import type {
  ManufacturingRuntime,
  ManufacturingRuntimeContext,
  ManufacturingRuntimeOptions,
  ManufacturingRuntimeServiceRegistration,
  ManufacturingRuntimeState,
} from "./types";

const PLATFORM_IDENTIFIER = "platform.manufacturing" as const;
const DEFAULT_RUNTIME_ID = "manufacturing-runtime";

const REQUIRED_PROVIDER_CAPABILITIES = [
  "manufacturing.runtime.audit-sink",
  "manufacturing.runtime.clock",
  "manufacturing.runtime.correlation",
  "manufacturing.runtime.identifier",
  "manufacturing.runtime.metadata",
  "manufacturing.runtime.observation-sink",
  "manufacturing.runtime.tenant-context",
] as const;

const REQUIRED_INTEGRATIONS: readonly ManufacturingIntegrationType[] = ["PRODUCT", "INVENTORY"];

function createInitialState(runtimeId: string): ManufacturingRuntimeState {
  return {
    runtimeId,
    phase: "CREATED",
    ready: false,
    trace: [
      "01.validate-manufacturing-runtime-options",
      "02.create-shared-runtime-host",
      "03.initialize-manufacturing-lifecycle-manager",
    ],
    providerIds: [],
    serviceIds: [],
    integrationIds: [],
  };
}

function cloneState(state: ManufacturingRuntimeState): ManufacturingRuntimeState {
  return {
    ...state,
    trace: [...state.trace],
    providerIds: [...state.providerIds],
    serviceIds: [...state.serviceIds],
    integrationIds: [...state.integrationIds],
  };
}

function validateOptions(options: ManufacturingRuntimeOptions): void {
  if (!options || typeof options !== "object") {
    throw new ManufacturingRuntimeError("INVALID_RUNTIME_OPTIONS", "manufacturing runtime options are required", false);
  }

  const dependencies = options.dependencies;
  if (!dependencies) {
    throw new ManufacturingRuntimeError("INVALID_RUNTIME_OPTIONS", "manufacturing runtime dependencies are required", false);
  }

  const required: Array<keyof ManufacturingRuntimeDependencies> = [
    "clockProvider",
    "identifierProvider",
    "tenantContextProvider",
    "metadataProvider",
    "auditSinkProvider",
    "observationSinkProvider",
    "correlationProvider",
  ];

  for (const key of required) {
    if (!dependencies[key]) {
      throw new ManufacturingRuntimeError("MISSING_REQUIRED_PROVIDER", `missing required provider: ${key}`, false);
    }
  }
}

function createRuntimeObservation(state: ManufacturingRuntimeState): ManufacturingRuntimeObservation {
  return {
    capability: "platform.manufacturing.runtime",
    runtimeId: state.runtimeId,
    phase: state.phase,
    ready: state.ready,
    generatedAt: state.initializedAt ?? new Date().toISOString(),
    providers: [...state.providerIds],
    services: [...state.serviceIds],
    integrations: [...state.integrationIds],
  };
}

function createRuntimeServices(
  runtimeId: string,
  dependencies: ManufacturingRuntimeDependencies,
): ManufacturingRuntimeServiceRegistration[] {
  return [
    {
      serviceId: "manufacturing.platform-identifier",
      contract: "manufacturing.platform-identifier",
      description: "Stable platform identifier token for runtime composition.",
      value: PLATFORM_IDENTIFIER,
    },
    {
      serviceId: "manufacturing.provider.audit",
      contract: "manufacturing.provider.audit",
      description: "Mechanical audit sink provider contract for runtime composition.",
      value: dependencies.auditSinkProvider,
    },
    {
      serviceId: "manufacturing.provider.clock",
      contract: "manufacturing.provider.clock",
      description: "Mechanical clock provider contract for runtime composition.",
      value: dependencies.clockProvider,
    },
    {
      serviceId: "manufacturing.provider.correlation",
      contract: "manufacturing.provider.correlation",
      description: "Mechanical correlation provider contract for runtime composition.",
      value: dependencies.correlationProvider,
    },
    {
      serviceId: "manufacturing.provider.identifier",
      contract: "manufacturing.provider.identifier",
      description: "Mechanical identifier provider contract for runtime composition.",
      value: dependencies.identifierProvider,
    },
    {
      serviceId: "manufacturing.provider.observation",
      contract: "manufacturing.provider.observation",
      description: "Mechanical observation sink provider contract for runtime composition.",
      value: dependencies.observationSinkProvider,
    },
    {
      serviceId: "manufacturing.provider.runtime-metadata",
      contract: "manufacturing.provider.runtime-metadata",
      description: "Mechanical runtime metadata provider contract for runtime composition.",
      value: dependencies.metadataProvider,
    },
    {
      serviceId: "manufacturing.provider.tenant-context",
      contract: "manufacturing.provider.tenant-context",
      description: "Mechanical tenant context provider contract for runtime composition.",
      value: dependencies.tenantContextProvider,
    },
    {
      serviceId: "manufacturing.runtime",
      contract: "manufacturing.runtime",
      description: "Runtime identity token for manufacturing composition.",
      value: { runtimeId },
    },
    {
      serviceId: "manufacturing.runtime-metadata",
      contract: "manufacturing.runtime-metadata",
      description: "Manufacturing runtime metadata token.",
      value: dependencies.metadataProvider.getRuntimeMetadata(),
    },
  ].sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId));
}

function appendTrace(
  host: RuntimeHost<ManufacturingRuntimeState, ManufacturingRuntimeServiceRegistration>,
  step: string,
  patch?: Partial<ManufacturingRuntimeState>,
): void {
  const next = cloneState(host.getState());
  next.trace = [...next.trace, step];
  host.setState({ ...next, ...patch });
}

function recordFailure(
  host: RuntimeHost<ManufacturingRuntimeState, ManufacturingRuntimeServiceRegistration>,
  dependencies: ManufacturingRuntimeDependencies,
  code: ConstructorParameters<typeof ManufacturingRuntimeError>[0],
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

function isProductPort(port: unknown): boolean {
  if (!port || typeof port !== "object") {
    return false;
  }
  const candidate = port as Record<string, unknown>;
  return (
    typeof candidate.validateProductReference === "function" &&
    typeof candidate.validateVariantReference === "function" &&
    typeof candidate.validateProductVersionReference === "function" &&
    typeof candidate.validateBomReference === "function" &&
    typeof candidate.validateRoutingReference === "function" &&
    typeof candidate.validateConfigurationReference === "function"
  );
}

function isInventoryPort(port: unknown): boolean {
  if (!port || typeof port !== "object") {
    return false;
  }
  const candidate = port as Record<string, unknown>;
  return (
    typeof candidate.queryAvailability === "function" &&
    typeof candidate.requestReservation === "function" &&
    typeof candidate.requestAllocation === "function" &&
    typeof candidate.releaseReservation === "function" &&
    typeof candidate.releaseAllocation === "function" &&
    typeof candidate.requestMaterialIssue === "function" &&
    typeof candidate.requestMaterialReturn === "function" &&
    typeof candidate.requestFinishedGoodsReceipt === "function" &&
    typeof candidate.requestWriteOff === "function" &&
    typeof candidate.validateInventoryMovement === "function" &&
    typeof candidate.validateLot === "function" &&
    typeof candidate.validateSerial === "function"
  );
}

function isExternalReferenceValidatorPort(port: unknown): boolean {
  if (!port || typeof port !== "object") {
    return false;
  }
  const candidate = port as Record<string, unknown>;
  return typeof candidate.validateExternalReference === "function";
}

function buildRuntime(options: ManufacturingRuntimeOptions): ManufacturingRuntime {
  validateOptions(options);

  const runtimeId = options.runtimeId?.trim() || DEFAULT_RUNTIME_ID;
  const host = new RuntimeHost<ManufacturingRuntimeState, ManufacturingRuntimeServiceRegistration>({
    runtimeId,
    initialState: createInitialState(runtimeId),
  });

  const baseDependencies = options.dependencies;
  const manufacturingAuditService = new ManufacturingAuditService({
    clock: baseDependencies.clockProvider,
    upstreamAuditSink: baseDependencies.auditSinkProvider,
  });
  const dependencies: ManufacturingRuntimeDependencies = {
    ...baseDependencies,
    auditSinkProvider: manufacturingAuditService.getAuditSinkProvider(),
  };
  const observers = new ObserverRegistry<ManufacturingRuntimeObservation>();
  const integrationRegistrations = new Map<string, ManufacturingIntegrationRegistration>();

  const context: ManufacturingRuntimeContext = {
    host,
    lifecycle: host.lifecycle,
    providers: host.providers,
    services: host.services,
    observers,
    dependencies,
    registerIntegration(registration) {
      if (!registration.integrationId || registration.integrationId.trim().length === 0) {
        throw new ManufacturingRuntimeError(
          "INTEGRATION_REGISTRATION_FAILURE",
          "integration registration id is required",
          false,
          host.snapshot(),
        );
      }

      if (
        registration.integrationType !== "PRODUCT" &&
        registration.integrationType !== "INVENTORY" &&
        registration.integrationType !== "EXTERNAL_REFERENCE_VALIDATOR"
      ) {
        throw new ManufacturingRuntimeError(
          "INTEGRATION_REGISTRATION_FAILURE",
          `unsupported integration type: ${registration.integrationType}`,
          false,
          host.snapshot(),
        );
      }

      const key = `${registration.integrationType}:${registration.integrationId}`;
      if (integrationRegistrations.has(key)) {
        throw new ManufacturingRuntimeError(
          "DUPLICATE_INTEGRATION_REGISTRATION",
          `duplicate integration registration: ${key}`,
          false,
          host.snapshot(),
        );
      }

      if (registration.integrationType === "PRODUCT" && !isProductPort(registration.port)) {
        throw new ManufacturingRuntimeError(
          "INTEGRATION_REGISTRATION_FAILURE",
          "product integration port contract is invalid",
          false,
          host.snapshot(),
        );
      }

      if (registration.integrationType === "INVENTORY" && !isInventoryPort(registration.port)) {
        throw new ManufacturingRuntimeError(
          "INTEGRATION_REGISTRATION_FAILURE",
          "inventory integration port contract is invalid",
          false,
          host.snapshot(),
        );
      }

      if (registration.integrationType === "EXTERNAL_REFERENCE_VALIDATOR" && !isExternalReferenceValidatorPort(registration.port)) {
        throw new ManufacturingRuntimeError(
          "INTEGRATION_REGISTRATION_FAILURE",
          "external reference validator integration port contract is invalid",
          false,
          host.snapshot(),
        );
      }

      if (
        (registration.integrationType === "PRODUCT" || registration.integrationType === "INVENTORY") &&
        [...integrationRegistrations.values()].some((existing) => existing.integrationType === registration.integrationType)
      ) {
        throw new ManufacturingRuntimeError(
          "DUPLICATE_INTEGRATION_REGISTRATION",
          `duplicate ${registration.integrationType.toLowerCase()} integration registration`,
          false,
          host.snapshot(),
        );
      }

      integrationRegistrations.set(key, registration);

      if (registration.integrationType === "PRODUCT") {
        host.registerService({
          serviceId: "manufacturing.integration.product-port",
          contract: "manufacturing.integration.product-port",
          description: "Bounded Product canonical-authority integration port contract.",
          value: registration.port,
        });
      }

      if (registration.integrationType === "INVENTORY") {
        host.registerService({
          serviceId: "manufacturing.integration.inventory-port",
          contract: "manufacturing.integration.inventory-port",
          description: "Bounded Inventory canonical-authority integration port contract.",
          value: registration.port,
        });
      }

      if (registration.integrationType === "EXTERNAL_REFERENCE_VALIDATOR") {
        host.registerService({
          serviceId: `manufacturing.integration.external-reference-validator.${registration.integrationId}`,
          contract: "manufacturing.integration.external-reference-validator",
          description: "Bounded external reference validator registration point contract.",
          value: registration.port,
        });
      }

      const next = cloneState(host.getState());
      next.integrationIds = [...integrationRegistrations.values()]
        .map((entry) => `${entry.integrationType}:${entry.integrationId}`)
        .sort(compareDeterministicStrings);
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);

      if (registration.dispose) {
        const stopStep = `90.dispose.${registration.integrationType.toLowerCase()}.${registration.integrationId}`;
        host.lifecycle.onStop(stopStep, async () => {
          appendTrace(host, `shutdown:dispose:${registration.integrationType}:${registration.integrationId}`);
          await registration.dispose?.();
        });
      }
    },
  };

  const runtime: ManufacturingRuntime = {
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
    getReadinessState() {
      const snapshot = host.snapshot();
      const providerCapabilities = new Set(host.providers.listProviders().map((provider) => provider.capability));
      const registeredIntegrationTypes = new Set(
        [...integrationRegistrations.values()].map((registration) => registration.integrationType),
      );

      const missingProviders = REQUIRED_PROVIDER_CAPABILITIES.filter((capability) => !providerCapabilities.has(capability));
      const missingIntegrations = REQUIRED_INTEGRATIONS.filter((integrationType) => !registeredIntegrationTypes.has(integrationType));

      return {
        ready: snapshot.state.ready && missingProviders.length === 0 && missingIntegrations.length === 0,
        checkedAt: dependencies.clockProvider.now(),
        requiredProviders: [...REQUIRED_PROVIDER_CAPABILITIES],
        requiredIntegrations: [...REQUIRED_INTEGRATIONS],
        missingProviders,
        missingIntegrations,
        lifecycle: snapshot.lifecycle,
      };
    },
    getShutdownState() {
      const state = host.getState();
      return {
        phase: state.phase,
        stopped: state.phase === "STOPPED",
        stoppedAt: state.stoppedAt,
        stopFailureCode: state.lastFailure?.code === "LIFECYCLE_STOP_FAILURE" ? state.lastFailure.code : undefined,
      };
    },
    getInitializationTrace() {
      return [...host.getState().trace];
    },
    async start() {
      const current = host.getState();
      if (current.phase !== "CREATED") {
        const message = current.phase === "READY" ? "manufacturing runtime is already ready" : `invalid runtime start state: ${current.phase}`;
        throw new ManufacturingRuntimeError("INVALID_RUNTIME_STATE", message, false, host.snapshot());
      }

      host.setState({
        ...cloneState(current),
        phase: "INITIALIZING",
        ready: false,
      });

      try {
        await host.start();
      } catch (error) {
        if (!host.getState().lastFailure) {
          const message = error instanceof Error ? error.message : "lifecycle start failed";
          recordFailure(host, dependencies, "LIFECYCLE_START_FAILURE", message);
        }
        const state = host.getState();
        throw new ManufacturingRuntimeError(
          state.lastFailure?.code ?? "LIFECYCLE_START_FAILURE",
          state.lastFailure?.message ?? "manufacturing runtime initialization failed",
          false,
          host.snapshot(),
        );
      }

      appendTrace(host, "12.establish-manufacturing-readiness");

      const next = cloneState(host.getState());
      next.phase = "READY";
      next.ready = true;
      next.initializedAt = dependencies.clockProvider.now();
      next.trace = [...next.trace, "13.mark-runtime-ready"];
      host.setState(next);

      await dependencies.observationSinkProvider.publishObservation(createRuntimeObservation(next));
    },
    async stop() {
      const current = host.getState();
      if (current.phase !== "READY") {
        throw new ManufacturingRuntimeError(
          "INVALID_RUNTIME_STATE",
          `invalid runtime stop state: ${current.phase}`,
          false,
          host.snapshot(),
        );
      }

      const stopping = cloneState(current);
      stopping.phase = "STOPPING";
      stopping.ready = false;
      stopping.trace = [...stopping.trace, "shutdown:01.transition-runtime-to-stopping"];
      host.setState(stopping);

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

      const stopped = cloneState(host.getState());
      stopped.phase = "STOPPED";
      stopped.ready = false;
      stopped.stoppedAt = dependencies.clockProvider.now();
      stopped.trace = [...stopped.trace, "shutdown:05.transition-runtime-to-stopped"];
      host.setState(stopped);

      await dependencies.observationSinkProvider.publishObservation(createRuntimeObservation(stopped));
    },
  };

  const providerHooks = options.providerRegistrationHooks ?? [];
  const serviceHooks = options.serviceRegistrationHooks ?? [];
  const integrationHooks = options.integrationRegistrationHooks ?? [];
  const lifecycleAdapters = options.lifecycleAdapters ?? [];

  for (const adapter of [...lifecycleAdapters].sort((left, right) => compareDeterministicStrings(left.adapterId, right.adapterId))) {
    adapter.register(context);
  }

  host.lifecycle.onBeforeStart("04.establish-manufacturing-dependency-container", async () => {
    appendTrace(host, "04.establish-manufacturing-dependency-container");
    try {
      host.registerService({
        serviceId: "manufacturing.runtime.dependencies",
        contract: "manufacturing.runtime.dependencies",
        description: "Dependency container token for future Manufacturing composition.",
        value: dependencies,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "dependency service registration failed";
      recordFailure(host, dependencies, "DUPLICATE_SERVICE_REGISTRATION", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("05.register-required-mechanical-providers", async () => {
    appendTrace(host, "05.register-required-mechanical-providers");
    const providers = [
      dependencies.auditSinkProvider,
      dependencies.clockProvider,
      dependencies.correlationProvider,
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
        await hook(context);
      }
      const next = cloneState(host.getState());
      next.providerIds = host.providers.listProviders().map((provider) => provider.providerId);
      host.setState(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "provider registration failed";
      recordFailure(host, dependencies, message.includes("registration conflict") ? "DUPLICATE_PROVIDER" : "MISSING_REQUIRED_PROVIDER", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("06.register-runtime-level-service-tokens", async () => {
    appendTrace(host, "06.register-runtime-level-service-tokens");
    try {
      for (const service of createRuntimeServices(runtimeId, dependencies)) {
        host.registerService(service);
      }
      for (const hook of serviceHooks) {
        await hook(context);
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

  host.lifecycle.onBeforeStart("07.register-bounded-product-integration-port", async () => {
    appendTrace(host, "07.register-bounded-product-integration-port");
    try {
      if (options.productIntegration) {
        context.registerIntegration({
          integrationId: options.productIntegration.integrationId,
          integrationType: "PRODUCT",
          port: options.productIntegration.port,
        });
      }
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "product integration registration failed";
      recordFailure(host, dependencies, "INTEGRATION_REGISTRATION_FAILURE", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("08.register-bounded-inventory-integration-port", async () => {
    appendTrace(host, "08.register-bounded-inventory-integration-port");
    try {
      if (options.inventoryIntegration) {
        context.registerIntegration({
          integrationId: options.inventoryIntegration.integrationId,
          integrationType: "INVENTORY",
          port: options.inventoryIntegration.port,
        });
      }
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "inventory integration registration failed";
      recordFailure(host, dependencies, "INTEGRATION_REGISTRATION_FAILURE", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09.register-future-external-reference-integration-points", async () => {
    appendTrace(host, "09.register-future-external-reference-integration-points");
    try {
      const future = options.externalReferenceIntegrations ?? [];
      const sortedFuture = [...future].sort((left, right) => {
        const byType = compareDeterministicStrings(left.integrationType, right.integrationType);
        if (byType !== 0) {
          return byType;
        }
        return compareDeterministicStrings(left.integrationId, right.integrationId);
      });
      for (const registration of sortedFuture) {
        context.registerIntegration(registration);
      }
      for (const hook of integrationHooks) {
        await hook(context);
      }
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "integration registration failed";
      recordFailure(host, dependencies, "INTEGRATION_REGISTRATION_FAILURE", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09a.register-slice3-foundation-services", async () => {
    appendTrace(host, "09a.register-slice3-foundation-services");
    try {
      const workOrders = new ManufacturingWorkOrderService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
      });
      const runs = new ProductionRunService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
      });
      const batches = new ProductionBatchService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        runs,
      });
      const queries = new ManufacturingFoundationQueryService({
        workOrders,
        runs,
        batches,
      });

      host.registerService({
        serviceId: "manufacturing.service.work-order",
        contract: "manufacturing.service.work-order",
        description: "Manufacturing Work Order foundation service.",
        value: workOrders,
      });
      host.registerService({
        serviceId: "manufacturing.service.production-run",
        contract: "manufacturing.service.production-run",
        description: "Manufacturing Production Run foundation service.",
        value: runs,
      });
      host.registerService({
        serviceId: "manufacturing.service.production-batch",
        contract: "manufacturing.service.production-batch",
        description: "Manufacturing Production Batch foundation service.",
        value: batches,
      });
      host.registerService({
        serviceId: "manufacturing.query.foundation",
        contract: "manufacturing.query.foundation",
        description: "Read-only Manufacturing foundation query surface.",
        value: queries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "foundation service registration failed";
      recordFailure(host, dependencies, "DUPLICATE_SERVICE_REGISTRATION", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09b.register-slice4-routing-operation-services", async () => {
    appendTrace(host, "09b.register-slice4-routing-operation-services");
    try {
      const workOrders = host.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
      const executionRouting = new ExecutionRoutingService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
      });
      const operations = new OperationExecutionService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        routings: executionRouting,
      });
      const routingQueries = new ManufacturingRoutingQueryService({
        routings: executionRouting,
        operations,
      });

      host.registerService({
        serviceId: "manufacturing.service.execution-routing",
        contract: "manufacturing.service.execution-routing",
        description: "Manufacturing execution routing service.",
        value: executionRouting,
      });
      host.registerService({
        serviceId: "manufacturing.service.operation-execution",
        contract: "manufacturing.service.operation-execution",
        description: "Manufacturing operation execution service.",
        value: operations,
      });
      host.registerService({
        serviceId: "manufacturing.query.routing",
        contract: "manufacturing.query.routing",
        description: "Read-only Manufacturing routing and operation query surface.",
        value: routingQueries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      const message = error instanceof Error ? error.message : "slice 4 service registration failed";
      recordFailure(host, dependencies, "DUPLICATE_SERVICE_REGISTRATION", message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09c.register-slice5-product-material-services", async () => {
    appendTrace(host, "09c.register-slice5-product-material-services");
    try {
      const workOrders = host.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
      const routing = host.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService;
      const productPort = host.services.require("manufacturing.integration.product-port").value as ManufacturingProductIntegrationPort;

      const productReferences = new ManufacturingProductReferenceService({
        clock: dependencies.clockProvider,
        metadata: dependencies.metadataProvider,
        audit: dependencies.auditSinkProvider,
        productPort,
        workOrders,
      });

      const materials = new MaterialRequirementService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        routings: routing,
      });

      const materialQueries = new ManufacturingMaterialQueryService({
        materials,
        workOrders,
      });

      host.registerService({
        serviceId: "manufacturing.service.product-reference",
        contract: "manufacturing.service.product-reference",
        description: "Manufacturing product baseline validation and freeze service.",
        value: productReferences,
      });
      host.registerService({
        serviceId: "manufacturing.service.material-requirement",
        contract: "manufacturing.service.material-requirement",
        description: "Manufacturing deterministic material requirement derivation service.",
        value: materials,
      });
      host.registerService({
        serviceId: "manufacturing.query.material",
        contract: "manufacturing.query.material",
        description: "Read-only Manufacturing material requirement query surface.",
        value: materialQueries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "slice 5 service registration failed";
      const code = message.includes("manufacturing.integration.product-port")
        ? "MISSING_REQUIRED_INTEGRATION"
        : message.includes("service not found")
          ? "PARTIAL_INITIALIZATION_REJECTED"
          : "DUPLICATE_SERVICE_REGISTRATION";
      recordFailure(host, dependencies, code, message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09d.register-slice6-inventory-material-execution-services", async () => {
    appendTrace(host, "09d.register-slice6-inventory-material-execution-services");
    try {
      const workOrders = host.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
      const materials = host.services.require("manufacturing.service.material-requirement").value as MaterialRequirementService;
      const inventoryPort = host.services.require("manufacturing.integration.inventory-port")
        .value as ManufacturingInventoryIntegrationPort;

      const inventory = new ManufacturingInventoryIntegrationService({
        inventoryPort,
      });

      const materialIssue = new MaterialIssueService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        materials,
        inventory,
      });

      const materialConsumption = new MaterialConsumptionService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        materials,
        inventory,
      });

      const materialExecutionQueries = new ManufacturingMaterialExecutionQueryService({
        materials,
        issues: materialIssue,
        consumption: materialConsumption,
      });

      host.registerService({
        serviceId: "manufacturing.service.inventory-integration",
        contract: "manufacturing.service.inventory-integration",
        description: "Manufacturing bounded inventory integration orchestration service.",
        value: inventory,
      });
      host.registerService({
        serviceId: "manufacturing.service.material-issue",
        contract: "manufacturing.service.material-issue",
        description: "Manufacturing material issue and return orchestration service.",
        value: materialIssue,
      });
      host.registerService({
        serviceId: "manufacturing.service.material-consumption",
        contract: "manufacturing.service.material-consumption",
        description: "Manufacturing material consumption execution service.",
        value: materialConsumption,
      });
      host.registerService({
        serviceId: "manufacturing.query.material-execution",
        contract: "manufacturing.query.material-execution",
        description: "Read-only Manufacturing material execution query surface.",
        value: materialExecutionQueries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "slice 6 service registration failed";
      const code = message.includes("manufacturing.integration.inventory-port")
        ? "MISSING_REQUIRED_INTEGRATION"
        : message.includes("service not found")
          ? "PARTIAL_INITIALIZATION_REJECTED"
          : "DUPLICATE_SERVICE_REGISTRATION";
      recordFailure(host, dependencies, code, message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09e.register-slice7-production-output-result-services", async () => {
    appendTrace(host, "09e.register-slice7-production-output-result-services");
    try {
      const workOrders = host.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
      const operations = host.services.require("manufacturing.service.operation-execution").value as OperationExecutionService;
      const routings = host.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService;
      const inventory = host.services.require("manufacturing.service.inventory-integration").value as ManufacturingInventoryIntegrationService;

      const wip = new WipService({
        identifier: dependencies.identifierProvider,
      });
      const outputs = new ProductionOutputService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
        inventory,
        wip,
      });
      const scrap = new ScrapService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
        inventory,
        workOrders,
        operations,
        wip,
      });
      const rework = new ReworkService({
        clock: dependencies.clockProvider,
        identifier: dependencies.identifierProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
        routings,
        wip,
      });
      const yields = new YieldService({
        outputs,
        scraps: scrap,
        now: () => dependencies.clockProvider.now(),
      });

      const resultQueries = new ManufacturingProductionResultQueryService({
        outputs,
        scraps: scrap,
        rework,
        yields,
        wip,
      });

      host.registerService({
        serviceId: "manufacturing.service.production-output",
        contract: "manufacturing.service.production-output",
        description: "Manufacturing production output service.",
        value: outputs,
      });
      host.registerService({
        serviceId: "manufacturing.service.scrap",
        contract: "manufacturing.service.scrap",
        description: "Manufacturing scrap fact service.",
        value: scrap,
      });
      host.registerService({
        serviceId: "manufacturing.service.rework",
        contract: "manufacturing.service.rework",
        description: "Manufacturing rework fact service.",
        value: rework,
      });
      host.registerService({
        serviceId: "manufacturing.service.yield",
        contract: "manufacturing.service.yield",
        description: "Manufacturing yield projection service.",
        value: yields,
      });
      host.registerService({
        serviceId: "manufacturing.service.wip",
        contract: "manufacturing.service.wip",
        description: "Manufacturing work-in-progress service.",
        value: wip,
      });
      host.registerService({
        serviceId: "manufacturing.query.production-result",
        contract: "manufacturing.query.production-result",
        description: "Read-only Manufacturing production result query surface.",
        value: resultQueries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "slice 7 service registration failed";
      const code = message.includes("service not found")
        ? "PARTIAL_INITIALIZATION_REJECTED"
        : "DUPLICATE_SERVICE_REGISTRATION";
      recordFailure(host, dependencies, code, message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09f.register-slice8-resource-downtime-traceability-services", async () => {
    appendTrace(host, "09f.register-slice8-resource-downtime-traceability-services");
    try {
      const workOrders = host.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
      const operations = host.services.require("manufacturing.service.operation-execution").value as OperationExecutionService;
      const routings = host.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService;

      const workCenters = new WorkCenterService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
      });
      const productionCells = new ProductionCellService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workCenters,
      });

      const machineAssignments = new MachineAssignmentService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
        workCenters,
        productionCells,
      });
      const toolAssignments = new ToolAssignmentService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
        workCenters,
        productionCells,
      });
      const laborAssignments = new LaborAssignmentService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
        workCenters,
        productionCells,
      });

      const readiness = new ResourceReadinessService({
        workOrders,
        routings,
        operations,
        machineAssignments,
        toolAssignments,
        laborAssignments,
      });

      machineAssignments.setReadinessSynchronizer((tenantId, workOrderId) => {
        readiness.synchronizeWorkOrderReadiness(tenantId, workOrderId);
      });
      toolAssignments.setReadinessSynchronizer((tenantId, workOrderId) => {
        readiness.synchronizeWorkOrderReadiness(tenantId, workOrderId);
      });
      laborAssignments.setReadinessSynchronizer((tenantId, workOrderId) => {
        readiness.synchronizeWorkOrderReadiness(tenantId, workOrderId);
      });

      const downtime = new DowntimeService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
      });

      const exceptions = new ExecutionExceptionService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
      });

      const traceability = new ManufacturingTraceabilityService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        workOrders,
        operations,
      });

      operations.registerOperationStartGuard((command, current) => {
        const operationReadiness = readiness.getOperationReadiness(
          command.tenantId,
          command.workOrderId,
          current.execution.operationExecutionId as string,
        );
        if (!operationReadiness?.ready) {
          throw new ManufacturingDomainError(
            "RESOURCE_NOT_READY",
            `resource readiness failed for operation ${current.execution.operationExecutionId}`,
            false,
          );
        }
        if (
          exceptions.hasActiveQualityHold(
            command.tenantId,
            command.workOrderId as string,
            current.execution.operationExecutionId as string,
          )
        ) {
          throw new ManufacturingDomainError(
            "QUALITY_HOLD_ACTIVE",
            `quality hold active for operation ${current.execution.operationExecutionId}`,
            false,
          );
        }
      });

      const resourceQueries = new ManufacturingResourceQueryService({
        workCenters,
        productionCells,
        machineAssignments,
        toolAssignments,
        laborAssignments,
        readiness,
        downtime,
        exceptions,
      });

      const traceQueries = new ManufacturingTraceabilityQueryService({
        traces: traceability,
      });

      host.registerService({
        serviceId: "manufacturing.service.work-center",
        contract: "manufacturing.service.work-center",
        description: "Manufacturing work center service.",
        value: workCenters,
      });
      host.registerService({
        serviceId: "manufacturing.service.production-cell",
        contract: "manufacturing.service.production-cell",
        description: "Manufacturing production cell service.",
        value: productionCells,
      });
      host.registerService({
        serviceId: "manufacturing.service.machine-assignment",
        contract: "manufacturing.service.machine-assignment",
        description: "Manufacturing machine assignment service.",
        value: machineAssignments,
      });
      host.registerService({
        serviceId: "manufacturing.service.tool-assignment",
        contract: "manufacturing.service.tool-assignment",
        description: "Manufacturing tool assignment service.",
        value: toolAssignments,
      });
      host.registerService({
        serviceId: "manufacturing.service.labor-assignment",
        contract: "manufacturing.service.labor-assignment",
        description: "Manufacturing labor assignment service.",
        value: laborAssignments,
      });
      host.registerService({
        serviceId: "manufacturing.service.resource-readiness",
        contract: "manufacturing.service.resource-readiness",
        description: "Manufacturing resource readiness service.",
        value: readiness,
      });
      host.registerService({
        serviceId: "manufacturing.service.downtime",
        contract: "manufacturing.service.downtime",
        description: "Manufacturing downtime service.",
        value: downtime,
      });
      host.registerService({
        serviceId: "manufacturing.service.execution-exception",
        contract: "manufacturing.service.execution-exception",
        description: "Manufacturing execution exception service.",
        value: exceptions,
      });
      host.registerService({
        serviceId: "manufacturing.service.traceability",
        contract: "manufacturing.service.traceability",
        description: "Manufacturing traceability service.",
        value: traceability,
      });
      host.registerService({
        serviceId: "manufacturing.query.resource",
        contract: "manufacturing.query.resource",
        description: "Read-only Manufacturing resource query surface.",
        value: resourceQueries,
      });
      host.registerService({
        serviceId: "manufacturing.query.traceability",
        contract: "manufacturing.query.traceability",
        description: "Read-only Manufacturing traceability query surface.",
        value: traceQueries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "slice 8 service registration failed";
      const code = message.includes("service not found")
        ? "PARTIAL_INITIALIZATION_REJECTED"
        : "DUPLICATE_SERVICE_REGISTRATION";
      recordFailure(host, dependencies, code, message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("09g.register-slice9-reference-validation-observability-services", async () => {
    appendTrace(host, "09g.register-slice9-reference-validation-observability-services");
    try {
      const workOrders = host.services.require("manufacturing.service.work-order").value as ManufacturingWorkOrderService;
      const routings = host.services.require("manufacturing.service.execution-routing").value as ExecutionRoutingService;
      const operations = host.services.require("manufacturing.service.operation-execution").value as OperationExecutionService;
      const materials = host.services.require("manufacturing.service.material-requirement").value as MaterialRequirementService;
      const issues = host.services.require("manufacturing.service.material-issue").value as MaterialIssueService;
      const consumption = host.services.require("manufacturing.service.material-consumption").value as MaterialConsumptionService;
      const materialExecutionQueries = host.services.require("manufacturing.query.material-execution")
        .value as ManufacturingMaterialExecutionQueryService;
      const resultQueries = host.services.require("manufacturing.query.production-result")
        .value as ManufacturingProductionResultQueryService;
      const resourceQueries = host.services.require("manufacturing.query.resource").value as ManufacturingResourceQueryService;
      const traceQueries = host.services.require("manufacturing.query.traceability")
        .value as ManufacturingTraceabilityQueryService;
      const productPort = host.services.require("manufacturing.integration.product-port").value as ManufacturingProductIntegrationPort;
      const inventoryPort = host.services.require("manufacturing.integration.inventory-port").value as ManufacturingInventoryIntegrationPort;

      const externalValidators = [...integrationRegistrations.values()]
        .filter((registration) => registration.integrationType === "EXTERNAL_REFERENCE_VALIDATOR")
        .sort((left, right) => compareDeterministicStrings(left.integrationId, right.integrationId))
        .map((registration) => ({
          integrationId: registration.integrationId,
          port: registration.port as ManufacturingExternalReferenceValidationPort,
          externalReferenceFamilies: registration.externalReferenceFamilies,
        }));

      const referenceValidation = new ManufacturingReferenceValidationService({
        clock: dependencies.clockProvider,
        audit: dependencies.auditSinkProvider,
        productPort,
        inventoryPort,
        externalValidators,
      });

      const workOrderReferenceValidator = new ManufacturingWorkOrderReferenceValidator({
        metadata: dependencies.metadataProvider,
        workOrders,
      });

      const metrics = new ManufacturingMetricsService({
        runtimeDependencies: dependencies,
        runtimeStateProvider: () => host.getState(),
        auditService: manufacturingAuditService,
        referenceService: referenceValidation,
        workOrders,
        routings,
        operations,
        materials,
        issues,
        consumption,
        materialExecutionQueries,
        resultQueries,
        resourceQueries,
        traceQueries,
      });

      const health = new ManufacturingHealthService({
        runtimeDependencies: dependencies,
        runtimeStateProvider: () => host.getState(),
        metricsService: metrics,
        referenceService: referenceValidation,
        workOrders,
        routings,
        operations,
        materials,
        materialExecutionQueries,
        resultQueries,
        resourceQueries,
        traceQueries,
        auditService: manufacturingAuditService,
      });

      const observationPublisher = new ManufacturingObservationPublisher({
        runtimeDependencies: dependencies,
        runtimeStateProvider: () => host.getState(),
        metricsService: metrics,
        healthService: health,
        referenceService: referenceValidation,
        auditService: manufacturingAuditService,
      });

      const observabilityQueries = new ManufacturingObservabilityQueryService({
        healthService: health,
        metricsService: metrics,
        auditService: manufacturingAuditService,
        referenceService: referenceValidation,
        observationPublisher,
      });

      host.registerService({
        serviceId: "manufacturing.service.reference-validation",
        contract: "manufacturing.service.reference-validation",
        description: "Centralized Manufacturing external reference validation service.",
        value: referenceValidation,
      });
      host.registerService({
        serviceId: "manufacturing.service.work-order-reference-validator",
        contract: "manufacturing.service.work-order-reference-validator",
        description: "Bounded Manufacturing Work Order reference validator surface.",
        value: workOrderReferenceValidator,
      });
      host.registerService({
        serviceId: "manufacturing.service.audit",
        contract: "manufacturing.service.audit",
        description: "Centralized Manufacturing audit aggregation service.",
        value: manufacturingAuditService,
      });
      host.registerService({
        serviceId: "manufacturing.service.metrics",
        contract: "manufacturing.service.metrics",
        description: "Manufacturing centralized metrics projection service.",
        value: metrics,
      });
      host.registerService({
        serviceId: "manufacturing.service.health",
        contract: "manufacturing.service.health",
        description: "Manufacturing runtime and domain health projection service.",
        value: health,
      });
      host.registerService({
        serviceId: "manufacturing.service.observation-publisher",
        contract: "manufacturing.service.observation-publisher",
        description: "Manufacturing Mission Control observation publisher service.",
        value: observationPublisher,
      });
      host.registerService({
        serviceId: "manufacturing.query.observation",
        contract: "manufacturing.query.observation",
        description: "Read-only Manufacturing observability query surface.",
        value: observabilityQueries,
      });

      const next = cloneState(host.getState());
      next.serviceIds = host.services.list().map((service) => service.serviceId);
      host.setState(next);
    } catch (error) {
      if (error instanceof ManufacturingDomainError && error.classification === "DUPLICATE_REFERENCE_VALIDATOR") {
        recordFailure(host, dependencies, "PARTIAL_INITIALIZATION_REJECTED", error.message);
        throw error;
      }
      if (error instanceof ManufacturingRuntimeError) {
        recordFailure(host, dependencies, error.code, error.message);
        throw error;
      }
      const message = error instanceof Error ? error.message : "slice 9 service registration failed";
      const code = message.includes("service not found")
        ? "PARTIAL_INITIALIZATION_REJECTED"
        : "DUPLICATE_SERVICE_REGISTRATION";
      recordFailure(host, dependencies, code, message);
      throw error;
    }
  });

  host.lifecycle.onBeforeStart("10.validate-required-registrations", async () => {
    appendTrace(host, "10.validate-required-registrations");
    const providerCapabilities = new Set(host.providers.listProviders().map((provider) => provider.capability));
    for (const capability of REQUIRED_PROVIDER_CAPABILITIES) {
      if (!providerCapabilities.has(capability)) {
        const message = `missing required provider capability: ${capability}`;
        recordFailure(host, dependencies, "MISSING_REQUIRED_PROVIDER", message);
        throw new Error(message);
      }
    }

    const requiredServices = new Set([
      "manufacturing.runtime",
      "manufacturing.runtime.dependencies",
      "manufacturing.runtime-metadata",
      "manufacturing.platform-identifier",
      "manufacturing.provider.clock",
      "manufacturing.provider.identifier",
      "manufacturing.provider.tenant-context",
      "manufacturing.provider.runtime-metadata",
      "manufacturing.provider.audit",
      "manufacturing.provider.observation",
      "manufacturing.provider.correlation",
      "manufacturing.service.work-order",
      "manufacturing.service.production-run",
      "manufacturing.service.production-batch",
      "manufacturing.query.foundation",
      "manufacturing.service.execution-routing",
      "manufacturing.service.operation-execution",
      "manufacturing.query.routing",
      "manufacturing.service.product-reference",
      "manufacturing.service.material-requirement",
      "manufacturing.query.material",
      "manufacturing.service.inventory-integration",
      "manufacturing.service.material-issue",
      "manufacturing.service.material-consumption",
      "manufacturing.query.material-execution",
      "manufacturing.service.production-output",
      "manufacturing.service.scrap",
      "manufacturing.service.rework",
      "manufacturing.service.yield",
      "manufacturing.service.wip",
      "manufacturing.query.production-result",
      "manufacturing.service.work-center",
      "manufacturing.service.production-cell",
      "manufacturing.service.machine-assignment",
      "manufacturing.service.tool-assignment",
      "manufacturing.service.labor-assignment",
      "manufacturing.service.resource-readiness",
      "manufacturing.service.downtime",
      "manufacturing.service.execution-exception",
      "manufacturing.service.traceability",
      "manufacturing.query.resource",
      "manufacturing.query.traceability",
      "manufacturing.service.reference-validation",
      "manufacturing.service.work-order-reference-validator",
      "manufacturing.service.audit",
      "manufacturing.service.metrics",
      "manufacturing.service.health",
      "manufacturing.service.observation-publisher",
      "manufacturing.query.observation",
    ]);
    for (const serviceId of requiredServices) {
      try {
        host.services.require(serviceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : `service not found: ${serviceId}`;
        recordFailure(host, dependencies, "PARTIAL_INITIALIZATION_REJECTED", message);
        throw error;
      }
    }

    const registeredIntegrationTypes = new Set(
      [...integrationRegistrations.values()].map((registration) => registration.integrationType),
    );
    for (const requiredIntegration of REQUIRED_INTEGRATIONS) {
      if (!registeredIntegrationTypes.has(requiredIntegration)) {
        const message = `missing required integration registration: ${requiredIntegration}`;
        recordFailure(host, dependencies, "MISSING_REQUIRED_INTEGRATION", message);
        throw new Error(message);
      }
    }

    const forbiddenBusinessServices = host.services.list().filter((service) =>
      [
        "manufacturing.service.routing",
        "manufacturing.service.output",
        "manufacturing.service.persistence",
        "manufacturing.service.maintenance",
        "manufacturing.service.quality-management",
        "manufacturing.service.observability",
      ].some((prefix) => service.serviceId.startsWith(prefix)),
    );
    if (forbiddenBusinessServices.length > 0) {
      const message = `forbidden business service registrations detected: ${forbiddenBusinessServices
        .map((service) => service.serviceId)
        .join(",")}`;
      recordFailure(host, dependencies, "PARTIAL_INITIALIZATION_REJECTED", message);
      throw new Error(message);
    }
  });

  host.lifecycle.onStart("11.start-shared-lifecycle", async () => {
    appendTrace(host, "11.start-shared-lifecycle");
  });

  host.lifecycle.onStop("10.dispose-manufacturing-observers", async () => {
    appendTrace(host, "shutdown:03.dispose-bounded-runtime-resources");
  });

  return runtime;
}

let singleton: ManufacturingRuntime | null = null;
let singletonInitialization: Promise<ManufacturingRuntime> | null = null;

export async function createManufacturingRuntime(options: ManufacturingRuntimeOptions): Promise<ManufacturingRuntime> {
  const runtime = buildRuntime(options);
  await runtime.start();
  return runtime;
}

export async function initializeManufacturingRuntime(options: ManufacturingRuntimeOptions): Promise<ManufacturingRuntime> {
  if (singleton || singletonInitialization) {
    throw new ManufacturingRuntimeError("DUPLICATE_INITIALIZATION", "manufacturing runtime has already been initialized", false);
  }

  singletonInitialization = createManufacturingRuntime(options)
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

export function getManufacturingRuntime(): ManufacturingRuntime {
  if (!singleton) {
    throw new ManufacturingRuntimeError("RUNTIME_NOT_READY", "manufacturing runtime has not been initialized", false);
  }
  return singleton;
}

export async function resetManufacturingRuntimeForTests(): Promise<void> {
  const runtime = singleton;
  singleton = null;
  singletonInitialization = null;

  if (!runtime) {
    return;
  }

  const phase = runtime.snapshot().state.phase;
  if (phase === "READY") {
    await runtime.stop();
  }
}

export const manufacturingRuntimeFactory = {
  async create(options: ManufacturingRuntimeOptions): Promise<ManufacturingRuntime> {
    return createManufacturingRuntime(options);
  },
  async initializeSingleton(options: ManufacturingRuntimeOptions): Promise<ManufacturingRuntime> {
    return initializeManufacturingRuntime(options);
  },
  getSingleton(): ManufacturingRuntime {
    return getManufacturingRuntime();
  },
  async resetSingletonForTests(): Promise<void> {
    await resetManufacturingRuntimeForTests();
  },
};
