import { compareDeterministicStrings } from "../../shared";
import type { InventoryRuntimeAuditRecord } from "../integration";
import type {
  InventoryRuntimeContext,
  InventoryRuntimeServiceRegistration,
  InventoryServiceRegistrationHook,
} from "../runtime";
import {
  InventoryPersistenceCoordinator,
} from "../persistence/InventoryPersistenceCoordinator";
import type { InventoryPersistenceEnvelope } from "../persistence/types";
import { createInventorySlice8Services, type InventorySlice8Services } from "./observability";
import type { InventoryReferenceValidatorRegistry } from "../integration";

export type InventorySlice9Services = Readonly<{
  slice8: InventorySlice8Services;
  persistenceCoordinator: InventoryPersistenceCoordinator;
  loadedEnvelope: InventoryPersistenceEnvelope;
}>;

export function createInventorySlice9Services(options: Readonly<{
  rootDir: string;
  runtimeId: string;
  dependencies: InventoryRuntimeContext["dependencies"];
  validatorRegistry: InventoryReferenceValidatorRegistry;
}>): Promise<InventorySlice9Services> {
  const persistenceCoordinator = new InventoryPersistenceCoordinator({
    rootDir: options.rootDir,
    runtimeId: options.runtimeId,
    dependencies: options.dependencies,
    validatorRegistry: options.validatorRegistry,
  });

  let slice8Services: InventorySlice8Services | undefined;
  const auditSinkProxy = {
    ...options.dependencies.auditSinkProvider,
    providerId: `${options.dependencies.auditSinkProvider.providerId}.inventory-persistence`,
    async recordAudit(record: InventoryRuntimeAuditRecord) {
      await options.dependencies.auditSinkProvider.recordAudit(record);
      if (record.details?.success === true && slice8Services) {
        await persistenceCoordinator.persist(slice8Services);
      }
    },
  };

  const slice8 = createInventorySlice8Services({
    dependencies: {
      ...options.dependencies,
      auditSinkProvider: auditSinkProxy,
    },
    validatorRegistry: options.validatorRegistry,
  });
  slice8Services = slice8;

  return persistenceCoordinator.loadAndRecover().then((loadedEnvelope) => {
    if (loadedEnvelope.tenants.length > 0) {
      persistenceCoordinator.restore(slice8, loadedEnvelope);
    }
    return {
      slice8,
      persistenceCoordinator,
      loadedEnvelope,
    };
  });
}

export function createInventorySlice9ServiceRegistrationHook(options: Readonly<{
  rootDir: string;
  validatorRegistry: InventoryReferenceValidatorRegistry;
}>): InventoryServiceRegistrationHook {
  return async (context: InventoryRuntimeContext) => {
    const services = await createInventorySlice9Services({
      rootDir: options.rootDir,
      runtimeId: context.host.getState().runtimeId,
      dependencies: context.dependencies,
      validatorRegistry: options.validatorRegistry,
    });

    const registrations: InventoryRuntimeServiceRegistration[] = [
      {
        serviceId: "inventory.service.inventory-item",
        contract: "inventory.service.inventory-item",
        description: "Slice 9 inventory item service.",
        value: services.slice8.slice6.slice5.slice4.foundation.inventoryItemService,
      },
      {
        serviceId: "inventory.service.warehouse",
        contract: "inventory.service.warehouse",
        description: "Slice 9 warehouse service.",
        value: services.slice8.slice6.slice5.slice4.foundation.warehouseService,
      },
      {
        serviceId: "inventory.service.storage-location",
        contract: "inventory.service.storage-location",
        description: "Slice 9 storage location service.",
        value: services.slice8.slice6.slice5.slice4.foundation.storageLocationService,
      },
      {
        serviceId: "inventory.service.bin",
        contract: "inventory.service.bin",
        description: "Slice 9 bin service.",
        value: services.slice8.slice6.slice5.slice4.foundation.binService,
      },
      {
        serviceId: "inventory.service.inventory-balance",
        contract: "inventory.service.inventory-balance",
        description: "Slice 9 inventory balance service.",
        value: services.slice8.slice6.slice5.slice4.foundation.inventoryBalanceService,
      },
      {
        serviceId: "inventory.service.foundation-query",
        contract: "inventory.service.foundation-query",
        description: "Slice 9 foundation query service.",
        value: services.slice8.slice6.slice5.slice4.foundationQueries,
      },
      {
        serviceId: "inventory.service.reference-validator-registry",
        contract: "inventory.service.reference-validator-registry",
        description: "Slice 9 reference validator registry.",
        value: options.validatorRegistry,
      },
      {
        serviceId: "inventory.service.reference-validation",
        contract: "inventory.service.reference-validation",
        description: "Slice 9 reference validation service.",
        value: services.slice8.slice6.slice5.slice4.referenceValidationService,
      },
      {
        serviceId: "inventory.service.inventory-movement",
        contract: "inventory.service.inventory-movement",
        description: "Slice 9 inventory movement service.",
        value: services.slice8.slice6.slice5.slice4.movementService,
      },
      {
        serviceId: "inventory.service.inventory-adjustment",
        contract: "inventory.service.inventory-adjustment",
        description: "Slice 9 inventory adjustment service.",
        value: services.slice8.slice6.slice5.slice4.movementService,
      },
      {
        serviceId: "inventory.service.inventory-ledger",
        contract: "inventory.service.inventory-ledger",
        description: "Slice 9 inventory ledger service.",
        value: services.slice8.slice6.slice5.slice4.ledgerService,
      },
      {
        serviceId: "inventory.service.movement-query",
        contract: "inventory.service.movement-query",
        description: "Slice 9 movement query service.",
        value: services.slice8.slice6.slice5.slice4.movementQueryService,
      },
      {
        serviceId: "inventory.service.reservation",
        contract: "inventory.service.reservation",
        description: "Slice 9 reservation service.",
        value: services.slice8.slice6.slice5.reservationService,
      },
      {
        serviceId: "inventory.service.allocation",
        contract: "inventory.service.allocation",
        description: "Slice 9 allocation service.",
        value: services.slice8.slice6.slice5.allocationService,
      },
      {
        serviceId: "inventory.service.reservation-query",
        contract: "inventory.service.reservation-query",
        description: "Slice 9 reservation query service.",
        value: services.slice8.slice6.slice5.reservationQueryService,
      },
      {
        serviceId: "inventory.service.allocation-query",
        contract: "inventory.service.allocation-query",
        description: "Slice 9 allocation query service.",
        value: services.slice8.slice6.slice5.allocationQueryService,
      },
      {
        serviceId: "inventory.service.lot",
        contract: "inventory.service.lot",
        description: "Slice 9 lot service.",
        value: services.slice8.slice6.lotService,
      },
      {
        serviceId: "inventory.service.serial-number",
        contract: "inventory.service.serial-number",
        description: "Slice 9 serial number service.",
        value: services.slice8.slice6.serialNumberService,
      },
      {
        serviceId: "inventory.service.expiration",
        contract: "inventory.service.expiration",
        description: "Slice 9 expiration service.",
        value: services.slice8.slice6.expirationService,
      },
      {
        serviceId: "inventory.service.lot-query",
        contract: "inventory.service.lot-query",
        description: "Slice 9 lot query service.",
        value: services.slice8.slice6.lotQueryService,
      },
      {
        serviceId: "inventory.service.serial-query",
        contract: "inventory.service.serial-query",
        description: "Slice 9 serial query service.",
        value: services.slice8.slice6.serialQueryService,
      },
      {
        serviceId: "inventory.service.expiration-query",
        contract: "inventory.service.expiration-query",
        description: "Slice 9 expiration query service.",
        value: services.slice8.slice6.expirationQueryService,
      },
      {
        serviceId: "inventory.service.audit",
        contract: "inventory.service.audit",
        description: "Slice 9 inventory audit aggregation service.",
        value: services.slice8.auditService,
      },
      {
        serviceId: "inventory.service.health",
        contract: "inventory.service.health",
        description: "Slice 9 inventory health service.",
        value: services.slice8.healthService,
      },
      {
        serviceId: "inventory.service.metrics",
        contract: "inventory.service.metrics",
        description: "Slice 9 inventory metrics service.",
        value: services.slice8.metricsService,
      },
      {
        serviceId: "inventory.service.observation-publisher",
        contract: "inventory.service.observation-publisher",
        description: "Slice 9 mission control observation publisher.",
        value: services.slice8.observationService,
      },
      {
        serviceId: "inventory.service.observability-query",
        contract: "inventory.service.observability-query",
        description: "Slice 9 inventory observability query surface.",
        value: services.slice8.observabilityQueryService,
      },
      {
        serviceId: "inventory.service.persistence",
        contract: "inventory.service.persistence",
        description: "Slice 9 inventory persistence coordinator.",
        value: services.persistenceCoordinator,
      },
    ];

    for (const registration of registrations.sort((left, right) => compareDeterministicStrings(left.serviceId, right.serviceId))) {
      context.host.registerService(registration);
    }
  };
}
