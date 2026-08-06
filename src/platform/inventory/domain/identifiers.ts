import { assertRequiredString } from "../../shared/validation";
import type {
  AllocationId,
  AssetReferenceId,
  BinId,
  CommerceOrderReferenceId,
  ConcurrencyToken,
  DocumentReferenceId,
  ExpirationRecordId,
  FinanceClassificationReferenceId,
  IdempotencyKey,
  InventoryBalanceId,
  InventoryItemId,
  KnowledgeReferenceId,
  LedgerEntryId,
  LotId,
  ManufacturingWorkOrderReferenceId,
  MovementId,
  OrganizationReferenceId,
  ProductReferenceId,
  ProductVariantReferenceId,
  ReorderPolicyId,
  ReservationId,
  SerialNumberId,
  StorageLocationId,
  TenantId,
  VersionIdentifier,
  WarehouseId,
} from "../contracts";
import { InventoryDomainError } from "./errors";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;

type IdentifierMap = {
  TenantId: TenantId;
  InventoryItemId: InventoryItemId;
  InventoryBalanceId: InventoryBalanceId;
  WarehouseId: WarehouseId;
  StorageLocationId: StorageLocationId;
  BinId: BinId;
  ReservationId: ReservationId;
  AllocationId: AllocationId;
  MovementId: MovementId;
  LedgerEntryId: LedgerEntryId;
  LotId: LotId;
  SerialNumberId: SerialNumberId;
  ExpirationRecordId: ExpirationRecordId;
  ReorderPolicyId: ReorderPolicyId;
  ProductReferenceId: ProductReferenceId;
  ProductVariantReferenceId: ProductVariantReferenceId;
  OrganizationReferenceId: OrganizationReferenceId;
  DocumentReferenceId: DocumentReferenceId;
  KnowledgeReferenceId: KnowledgeReferenceId;
  AssetReferenceId: AssetReferenceId;
  CommerceOrderReferenceId: CommerceOrderReferenceId;
  ManufacturingWorkOrderReferenceId: ManufacturingWorkOrderReferenceId;
  FinanceClassificationReferenceId: FinanceClassificationReferenceId;
  VersionIdentifier: VersionIdentifier;
  ConcurrencyToken: ConcurrencyToken;
  IdempotencyKey: IdempotencyKey;
};

export type InventoryIdentifierBrand = keyof IdentifierMap;

export function createInventoryIdentifier<TBrand extends InventoryIdentifierBrand>(
  value: string,
  brand: TBrand,
): IdentifierMap[TBrand] {
  assertRequiredString(value, brand);
  if (!identifierPattern.test(value)) {
    throw new InventoryDomainError("INVALID_COMMAND", `invalid ${brand}: ${value}`, false);
  }
  return value as IdentifierMap[TBrand];
}

export function assertImmutableIdentity(previous: string, next: string, label: string): void {
  if (previous !== next) {
    throw new InventoryDomainError("IMMUTABLE_IDENTITY_VIOLATION", `${label} is immutable`, false);
  }
}

export function assertTenantScope(tenantId: TenantId, candidateTenantIds: readonly TenantId[]): void {
  for (const candidate of candidateTenantIds) {
    if (candidate !== tenantId) {
      throw new InventoryDomainError("TENANT_ISOLATION_VIOLATION", "tenant isolation violated", false);
    }
  }
}
