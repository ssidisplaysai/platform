import { assertRequiredString } from "../../shared/validation";
import type {
  AssetIdentifier,
  BatchCode,
  CommerceOrderIdentifier,
  ConcurrencyToken,
  CorrelationIdentifier,
  DocumentIdentifier,
  ExecutionRoutingId,
  ExecutionVersion,
  ExpectedVersion,
  FinanceClassificationIdentifier,
  IdempotencyKey,
  InventoryAllocationIdentifier,
  InventoryItemIdentifier,
  InventoryMovementIdentifier,
  InventoryReservationIdentifier,
  KnowledgeIdentifier,
  LaborAssignmentId,
  MachineAssignmentId,
  ManufacturingJobId,
  ManufacturingOperationId,
  ManufacturingWorkOrderId,
  MaterialConsumptionId,
  MaterialIssueRequestId,
  MaterialRequirementId,
  OperationCode,
  OperationExecutionId,
  OrganizationIdentifier,
  PersonOrContactIdentifier,
  ProductBomIdentifier,
  ProductIdentifier,
  ProductVariantIdentifier,
  ProductVersionIdentifier,
  ProductionBatchId,
  ProductionCellCode,
  ProductionCellId,
  ProductionOrderId,
  ProductionOrderNumber,
  ProductionOutputId,
  ProductionRunId,
  ProductionTraceId,
  ReworkRecordId,
  RoutingStepCode,
  RoutingStepId,
  RunCode,
  ScrapRecordId,
  SequenceNumber,
  TenantId,
  ToolAssignmentId,
  VersionIdentifier,
  WorkCenterCode,
  WorkCenterId,
  WorkOrderNumber,
  YieldRecordId,
  DowntimeRecordId,
  ExecutionExceptionId,
} from "../contracts";
import { ManufacturingDomainError } from "./errors";

const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?$/;

type IdentifierMap = {
  TenantId: TenantId;
  ManufacturingWorkOrderId: ManufacturingWorkOrderId;
  ProductionOrderId: ProductionOrderId;
  ProductionRunId: ProductionRunId;
  ProductionBatchId: ProductionBatchId;
  ManufacturingJobId: ManufacturingJobId;
  ExecutionRoutingId: ExecutionRoutingId;
  RoutingStepId: RoutingStepId;
  ManufacturingOperationId: ManufacturingOperationId;
  OperationExecutionId: OperationExecutionId;
  WorkCenterId: WorkCenterId;
  ProductionCellId: ProductionCellId;
  MachineAssignmentId: MachineAssignmentId;
  ToolAssignmentId: ToolAssignmentId;
  LaborAssignmentId: LaborAssignmentId;
  MaterialRequirementId: MaterialRequirementId;
  MaterialIssueRequestId: MaterialIssueRequestId;
  MaterialConsumptionId: MaterialConsumptionId;
  ProductionOutputId: ProductionOutputId;
  ScrapRecordId: ScrapRecordId;
  ReworkRecordId: ReworkRecordId;
  YieldRecordId: YieldRecordId;
  DowntimeRecordId: DowntimeRecordId;
  ExecutionExceptionId: ExecutionExceptionId;
  ProductionTraceId: ProductionTraceId;
  VersionIdentifier: VersionIdentifier;
  ConcurrencyToken: ConcurrencyToken;
  IdempotencyKey: IdempotencyKey;
  CorrelationIdentifier: CorrelationIdentifier;
  WorkOrderNumber: WorkOrderNumber;
  ProductionOrderNumber: ProductionOrderNumber;
  RunCode: RunCode;
  BatchCode: BatchCode;
  OperationCode: OperationCode;
  RoutingStepCode: RoutingStepCode;
  WorkCenterCode: WorkCenterCode;
  ProductionCellCode: ProductionCellCode;
  ProductIdentifier: ProductIdentifier;
  ProductVariantIdentifier: ProductVariantIdentifier;
  ProductVersionIdentifier: ProductVersionIdentifier;
  ProductBomIdentifier: ProductBomIdentifier;
  InventoryItemIdentifier: InventoryItemIdentifier;
  InventoryReservationIdentifier: InventoryReservationIdentifier;
  InventoryAllocationIdentifier: InventoryAllocationIdentifier;
  InventoryMovementIdentifier: InventoryMovementIdentifier;
  OrganizationIdentifier: OrganizationIdentifier;
  PersonOrContactIdentifier: PersonOrContactIdentifier;
  AssetIdentifier: AssetIdentifier;
  DocumentIdentifier: DocumentIdentifier;
  KnowledgeIdentifier: KnowledgeIdentifier;
  CommerceOrderIdentifier: CommerceOrderIdentifier;
  FinanceClassificationIdentifier: FinanceClassificationIdentifier;
};

export type ManufacturingIdentifierBrand = keyof IdentifierMap;

export function createManufacturingIdentifier<TBrand extends ManufacturingIdentifierBrand>(
  value: string,
  brand: TBrand,
): IdentifierMap[TBrand] {
  assertRequiredString(value, brand);
  if (!identifierPattern.test(value)) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", `invalid ${brand}: ${value}`, false);
  }
  if (brand === "VersionIdentifier" && !semverPattern.test(value)) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", "version identifier must be semantic version", false);
  }
  return value as IdentifierMap[TBrand];
}

export function createSequenceNumber(value: number): SequenceNumber {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", "sequence number must be a positive integer", false);
  }
  return value as SequenceNumber;
}

export function createExpectedVersion(value: number): ExpectedVersion {
  if (!Number.isInteger(value) || value < 0) {
    throw new ManufacturingDomainError("STALE_EXPECTED_VERSION", "expected version must be a non-negative integer", false);
  }
  return value as ExpectedVersion;
}

export function createExecutionVersion(value: number): ExecutionVersion {
  if (!Number.isInteger(value) || value < 0) {
    throw new ManufacturingDomainError("INVALID_IDENTIFIER", "execution version must be a non-negative integer", false);
  }
  return value as ExecutionVersion;
}

export function assertImmutableIdentity(previous: string, next: string, label: string): void {
  if (previous !== next) {
    throw new ManufacturingDomainError("DUPLICATE_IDENTITY", `${label} identity is immutable`, false);
  }
}

export function assertTenantScope(tenantId: TenantId, candidates: readonly TenantId[]): void {
  for (const candidate of candidates) {
    if (candidate !== tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "cross-tenant association is prohibited", false);
    }
  }
}

export function assertBusinessIdentifierAvailable(
  candidate: string,
  activeIdentifiers: readonly string[],
  retiredIdentifiers: readonly string[],
  reuseApproved: boolean,
): void {
  if (activeIdentifiers.includes(candidate)) {
    throw new ManufacturingDomainError("DUPLICATE_BUSINESS_IDENTIFIER", `duplicate business identifier: ${candidate}`, false);
  }
  if (retiredIdentifiers.includes(candidate) && !reuseApproved) {
    throw new ManufacturingDomainError("DUPLICATE_BUSINESS_IDENTIFIER", `identifier retired and cannot be reused: ${candidate}`, false);
  }
}
