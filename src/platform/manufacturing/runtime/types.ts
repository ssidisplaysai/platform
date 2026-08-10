import type {
  LifecycleManager,
  LifecycleStopError,
  ObserverRegistry,
  ProviderRegistry,
  RuntimeHost,
  RuntimeSnapshot,
  ServiceRegistry,
} from "../../shared";
import type {
  ManufacturingIntegrationRegistration,
  ManufacturingIntegrationType,
  ManufacturingRuntimeDependencies,
  ManufacturingRuntimeObservation,
} from "../integration";
import type { ManufacturingRuntimeErrorCode } from "./errors";

export type ManufacturingRuntimePhase = "CREATED" | "INITIALIZING" | "READY" | "STOPPING" | "STOPPED" | "FAILED";

export type ManufacturingRuntimeFailureEvidence = Readonly<{
  code: ManufacturingRuntimeErrorCode;
  message: string;
  occurredAt: string;
}>;

export type ManufacturingRuntimeReadinessState = Readonly<{
  ready: boolean;
  checkedAt: string;
  requiredProviders: readonly string[];
  requiredIntegrations: readonly ManufacturingIntegrationType[];
  missingProviders: readonly string[];
  missingIntegrations: readonly ManufacturingIntegrationType[];
  lifecycle: string;
}>;

export type ManufacturingRuntimeShutdownState = Readonly<{
  phase: ManufacturingRuntimePhase;
  stopped: boolean;
  stoppedAt?: string;
  stopFailureCode?: ManufacturingRuntimeErrorCode;
}>;

export type ManufacturingRuntimeState = Readonly<{
  runtimeId: string;
  phase: ManufacturingRuntimePhase;
  ready: boolean;
  trace: readonly string[];
  providerIds: readonly string[];
  serviceIds: readonly string[];
  integrationIds: readonly string[];
  initializedAt?: string;
  stoppedAt?: string;
  lastFailure?: ManufacturingRuntimeFailureEvidence;
}>;

export type ManufacturingRuntimeServiceRegistration = Readonly<{
  serviceId: string;
  contract:
    | "manufacturing.runtime"
    | "manufacturing.runtime.dependencies"
    | "manufacturing.runtime-metadata"
    | "manufacturing.platform-identifier"
    | "manufacturing.provider.clock"
    | "manufacturing.provider.identifier"
    | "manufacturing.provider.tenant-context"
    | "manufacturing.provider.runtime-metadata"
    | "manufacturing.provider.audit"
    | "manufacturing.provider.observation"
    | "manufacturing.provider.correlation"
    | "manufacturing.service.work-order"
    | "manufacturing.service.production-run"
    | "manufacturing.service.production-batch"
    | "manufacturing.query.foundation"
    | "manufacturing.service.execution-routing"
    | "manufacturing.service.operation-execution"
    | "manufacturing.query.routing"
    | "manufacturing.service.product-reference"
    | "manufacturing.service.material-requirement"
    | "manufacturing.query.material"
    | "manufacturing.service.inventory-integration"
    | "manufacturing.service.material-issue"
    | "manufacturing.service.material-consumption"
    | "manufacturing.query.material-execution"
    | "manufacturing.service.production-output"
    | "manufacturing.service.scrap"
    | "manufacturing.service.rework"
    | "manufacturing.service.yield"
    | "manufacturing.service.wip"
    | "manufacturing.query.production-result"
    | "manufacturing.service.work-center"
    | "manufacturing.service.production-cell"
    | "manufacturing.service.machine-assignment"
    | "manufacturing.service.tool-assignment"
    | "manufacturing.service.labor-assignment"
    | "manufacturing.service.resource-readiness"
    | "manufacturing.service.downtime"
    | "manufacturing.service.execution-exception"
    | "manufacturing.service.traceability"
    | "manufacturing.query.resource"
    | "manufacturing.query.traceability"
    | "manufacturing.integration.product-port"
    | "manufacturing.integration.inventory-port"
    | "manufacturing.integration.external-reference-validator";
  description: string;
  value: unknown;
}>;

export type ManufacturingRuntimeContext = Readonly<{
  host: RuntimeHost<ManufacturingRuntimeState, ManufacturingRuntimeServiceRegistration>;
  lifecycle: LifecycleManager;
  providers: ProviderRegistry;
  services: ServiceRegistry<ManufacturingRuntimeServiceRegistration>;
  observers: ObserverRegistry<ManufacturingRuntimeObservation>;
  dependencies: ManufacturingRuntimeDependencies;
  registerIntegration(registration: ManufacturingIntegrationRegistration): void;
}>;

export type ManufacturingProviderRegistrationHook = (context: ManufacturingRuntimeContext) => void | Promise<void>;
export type ManufacturingServiceRegistrationHook = (context: ManufacturingRuntimeContext) => void | Promise<void>;
export type ManufacturingIntegrationRegistrationHook = (context: ManufacturingRuntimeContext) => void | Promise<void>;

export type ManufacturingLifecycleAdapter = {
  adapterId: string;
  register(context: ManufacturingRuntimeContext): void;
};

export type ManufacturingRuntimeOptions = Readonly<{
  runtimeId?: string;
  dependencies: ManufacturingRuntimeDependencies;
  productIntegration?: Readonly<{
    integrationId: string;
    port: ManufacturingIntegrationRegistration["port"];
  }>;
  inventoryIntegration?: Readonly<{
    integrationId: string;
    port: ManufacturingIntegrationRegistration["port"];
  }>;
  externalReferenceIntegrations?: readonly ManufacturingIntegrationRegistration[];
  providerRegistrationHooks?: readonly ManufacturingProviderRegistrationHook[];
  serviceRegistrationHooks?: readonly ManufacturingServiceRegistrationHook[];
  integrationRegistrationHooks?: readonly ManufacturingIntegrationRegistrationHook[];
  lifecycleAdapters?: readonly ManufacturingLifecycleAdapter[];
}>;

export type ManufacturingRuntime = Readonly<{
  host: RuntimeHost<ManufacturingRuntimeState, ManufacturingRuntimeServiceRegistration>;
  dependencies: ManufacturingRuntimeDependencies;
  observers: ObserverRegistry<ManufacturingRuntimeObservation>;
  lifecycle: LifecycleManager;
  providers: ProviderRegistry;
  services: ServiceRegistry<ManufacturingRuntimeServiceRegistration>;
  snapshot(): RuntimeSnapshot<ManufacturingRuntimeState>;
  isReady(): boolean;
  getReadinessState(): ManufacturingRuntimeReadinessState;
  getShutdownState(): ManufacturingRuntimeShutdownState;
  getInitializationTrace(): readonly string[];
  start(): Promise<void>;
  stop(): Promise<void>;
}>;

export type ManufacturingRuntimeFactory = Readonly<{
  create(options: ManufacturingRuntimeOptions): Promise<ManufacturingRuntime>;
  initializeSingleton(options: ManufacturingRuntimeOptions): Promise<ManufacturingRuntime>;
  getSingleton(): ManufacturingRuntime;
  resetSingletonForTests(): Promise<void>;
}>;

export type ManufacturingRuntimeStopFailure = LifecycleStopError;
