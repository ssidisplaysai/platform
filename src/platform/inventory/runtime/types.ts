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
  InventoryIntegrationAdapter,
  InventoryRuntimeDependencies,
  InventoryRuntimeObservation,
  InventoryReferenceValidatorRegistrationPoint,
} from "../integration";
import type { InventoryRuntimeErrorCode } from "./errors";

export type InventoryRuntimePhase = "CREATED" | "INITIALIZING" | "READY" | "STOPPING" | "STOPPED" | "FAILED";

export type InventoryRuntimeFailureEvidence = Readonly<{
  code: InventoryRuntimeErrorCode;
  message: string;
  occurredAt: string;
}>;

export type InventoryRuntimeState = Readonly<{
  runtimeId: string;
  phase: InventoryRuntimePhase;
  ready: boolean;
  trace: readonly string[];
  providerIds: readonly string[];
  serviceIds: readonly string[];
  referenceValidatorRegistrationPointIds: readonly string[];
  initializedAt?: string;
  stoppedAt?: string;
  lastFailure?: InventoryRuntimeFailureEvidence;
}>;

export type InventoryRuntimeServiceRegistration = Readonly<{
  serviceId: string;
  contract:
    | "inventory.runtime.dependencies"
    | "inventory.runtime.metadata"
    | "inventory.runtime.platform-identifier"
    | "inventory.runtime.tenant-context-provider"
    | "inventory.runtime.clock-provider"
    | "inventory.runtime.identifier-provider"
    | "inventory.runtime.audit-sink"
    | "inventory.runtime.observation-sink"
    | "inventory.service.inventory-item"
    | "inventory.service.warehouse"
    | "inventory.service.storage-location"
    | "inventory.service.bin"
    | "inventory.service.inventory-balance"
    | "inventory.service.foundation-query"
    | "inventory.service.reference-validator-registry"
    | "inventory.service.reference-validation"
    | "inventory.service.inventory-movement"
    | "inventory.service.inventory-adjustment"
    | "inventory.service.inventory-ledger"
    | "inventory.service.movement-query"
    | "inventory.service.reservation"
    | "inventory.service.allocation"
    | "inventory.service.reservation-query"
    | "inventory.service.allocation-query"
    | "inventory.service.lot"
    | "inventory.service.serial-number"
    | "inventory.service.expiration"
    | "inventory.service.lot-query"
    | "inventory.service.serial-query"
    | "inventory.service.expiration-query"
    | "inventory.service.audit"
    | "inventory.service.metrics"
    | "inventory.service.health"
    | "inventory.service.observation-publisher"
    | "inventory.service.observability-query";
  description: string;
  value: unknown;
}>;

export type InventoryRuntimeContext = Readonly<{
  host: RuntimeHost<InventoryRuntimeState, InventoryRuntimeServiceRegistration>;
  lifecycle: LifecycleManager;
  providers: ProviderRegistry;
  services: ServiceRegistry<InventoryRuntimeServiceRegistration>;
  observers: ObserverRegistry<InventoryRuntimeObservation>;
  dependencies: InventoryRuntimeDependencies;
  registerReferenceValidatorRegistrationPoint(point: InventoryReferenceValidatorRegistrationPoint): void;
}>;

export type InventoryProviderRegistrationHook = (context: InventoryRuntimeContext) => void;
export type InventoryServiceRegistrationHook = (context: InventoryRuntimeContext) => void;
export type InventoryLifecycleAdapter = {
  adapterId: string;
  register(context: InventoryRuntimeContext): void;
};

export type InventoryRuntimeOptions = Readonly<{
  runtimeId?: string;
  dependencies: InventoryRuntimeDependencies;
  providerRegistrationHooks?: readonly InventoryProviderRegistrationHook[];
  serviceRegistrationHooks?: readonly InventoryServiceRegistrationHook[];
  lifecycleAdapters?: readonly InventoryLifecycleAdapter[];
  integrationAdapters?: readonly InventoryIntegrationAdapter[];
}>;

export type InventoryRuntime = Readonly<{
  host: RuntimeHost<InventoryRuntimeState, InventoryRuntimeServiceRegistration>;
  dependencies: InventoryRuntimeDependencies;
  observers: ObserverRegistry<InventoryRuntimeObservation>;
  lifecycle: LifecycleManager;
  providers: ProviderRegistry;
  services: ServiceRegistry<InventoryRuntimeServiceRegistration>;
  snapshot(): RuntimeSnapshot<InventoryRuntimeState>;
  isReady(): boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}>;

export type InventoryRuntimeFactory = Readonly<{
  create(options: InventoryRuntimeOptions): Promise<InventoryRuntime>;
  initializeSingleton(options: InventoryRuntimeOptions): Promise<InventoryRuntime>;
  getSingleton(): InventoryRuntime;
  resetSingletonForTests(): Promise<void>;
}>;

export type InventoryRuntimeStopFailure = LifecycleStopError;
