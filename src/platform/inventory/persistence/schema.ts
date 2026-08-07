import type { InventoryPersistenceEnvelope } from "./types";
import { INVENTORY_PERSISTENCE_SCHEMA_VERSION } from "./types";

export type InventoryPersistenceSchemaValidator = {
  validateOrThrow(state: InventoryPersistenceEnvelope): void;
};

export function createInventoryPersistenceSchemaValidator(): InventoryPersistenceSchemaValidator {
  return {
    validateOrThrow(state: InventoryPersistenceEnvelope): void {
      if (!state || typeof state !== "object") {
        throw new Error("persisted inventory envelope must be an object");
      }
      if (!state.manifest || typeof state.manifest !== "object") {
        throw new Error("persisted inventory manifest is invalid");
      }
      if (state.manifest.schemaVersion !== INVENTORY_PERSISTENCE_SCHEMA_VERSION) {
        throw new Error(`unsupported schema version: ${state.manifest.schemaVersion}`);
      }
      if (typeof state.manifest.runtimeId !== "string") {
        throw new Error("persisted inventory manifest is invalid");
      }
      if (!Array.isArray(state.manifest.tenantIds)) {
        throw new Error("persisted inventory manifest tenant list is invalid");
      }
      if (!Array.isArray(state.tenants)) {
        throw new Error("persisted inventory tenants are invalid");
      }
    },
  };
}
