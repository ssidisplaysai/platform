export type Branded<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type TenantId = Branded<string, "TenantId">;

export type ManufacturingWorkOrderId = Branded<string, "ManufacturingWorkOrderId">;
export type ProductionOrderId = Branded<string, "ProductionOrderId">;
export type ProductionRunId = Branded<string, "ProductionRunId">;
export type ProductionBatchId = Branded<string, "ProductionBatchId">;
export type ManufacturingJobId = Branded<string, "ManufacturingJobId">;
export type ExecutionRoutingId = Branded<string, "ExecutionRoutingId">;
export type RoutingStepId = Branded<string, "RoutingStepId">;
export type ManufacturingOperationId = Branded<string, "ManufacturingOperationId">;
export type OperationExecutionId = Branded<string, "OperationExecutionId">;
export type WorkCenterId = Branded<string, "WorkCenterId">;
export type ProductionCellId = Branded<string, "ProductionCellId">;
export type MachineAssignmentId = Branded<string, "MachineAssignmentId">;
export type ToolAssignmentId = Branded<string, "ToolAssignmentId">;
export type LaborAssignmentId = Branded<string, "LaborAssignmentId">;
export type MaterialRequirementId = Branded<string, "MaterialRequirementId">;
export type BomLineIdentifier = Branded<string, "BomLineIdentifier">;
export type MaterialIssueRequestId = Branded<string, "MaterialIssueRequestId">;
export type MaterialConsumptionId = Branded<string, "MaterialConsumptionId">;
export type ProductionOutputId = Branded<string, "ProductionOutputId">;
export type ScrapRecordId = Branded<string, "ScrapRecordId">;
export type ReworkRecordId = Branded<string, "ReworkRecordId">;
export type YieldRecordId = Branded<string, "YieldRecordId">;
export type DowntimeRecordId = Branded<string, "DowntimeRecordId">;
export type ExecutionExceptionId = Branded<string, "ExecutionExceptionId">;
export type ProductionTraceId = Branded<string, "ProductionTraceId">;

export type VersionIdentifier = Branded<string, "VersionIdentifier">;
export type ExpectedVersion = Branded<number, "ExpectedVersion">;
export type ConcurrencyToken = Branded<string, "ConcurrencyToken">;
export type IdempotencyKey = Branded<string, "IdempotencyKey">;
export type CorrelationIdentifier = Branded<string, "CorrelationIdentifier">;

export type WorkOrderNumber = Branded<string, "WorkOrderNumber">;
export type ProductionOrderNumber = Branded<string, "ProductionOrderNumber">;
export type RunCode = Branded<string, "RunCode">;
export type BatchCode = Branded<string, "BatchCode">;
export type OperationCode = Branded<string, "OperationCode">;
export type RoutingStepCode = Branded<string, "RoutingStepCode">;
export type WorkCenterCode = Branded<string, "WorkCenterCode">;
export type ProductionCellCode = Branded<string, "ProductionCellCode">;

export type ProductIdentifier = Branded<string, "ProductIdentifier">;
export type ProductVariantIdentifier = Branded<string, "ProductVariantIdentifier">;
export type ProductVersionIdentifier = Branded<string, "ProductVersionIdentifier">;
export type ProductBomIdentifier = Branded<string, "ProductBomIdentifier">;
export type InventoryItemIdentifier = Branded<string, "InventoryItemIdentifier">;
export type InventoryReservationIdentifier = Branded<string, "InventoryReservationIdentifier">;
export type InventoryAllocationIdentifier = Branded<string, "InventoryAllocationIdentifier">;
export type InventoryMovementIdentifier = Branded<string, "InventoryMovementIdentifier">;
export type OrganizationIdentifier = Branded<string, "OrganizationIdentifier">;
export type PersonOrContactIdentifier = Branded<string, "PersonOrContactIdentifier">;
export type AssetIdentifier = Branded<string, "AssetIdentifier">;
export type DocumentIdentifier = Branded<string, "DocumentIdentifier">;
export type KnowledgeIdentifier = Branded<string, "KnowledgeIdentifier">;
export type CommerceOrderIdentifier = Branded<string, "CommerceOrderIdentifier">;
export type FinanceClassificationIdentifier = Branded<string, "FinanceClassificationIdentifier">;

export type UnitOfMeasure = Branded<string, "UnitOfMeasure">;

export type ManufacturingMetadataValue = string | number | boolean | null;
export type MetadataCollection = Readonly<Record<string, ManufacturingMetadataValue>>;

export type QuantityWithUnit = Readonly<{
  value: number;
  unitOfMeasure: UnitOfMeasure;
}>;

export type PlannedQuantity = Branded<QuantityWithUnit, "PlannedQuantity">;
export type RequestedQuantity = Branded<QuantityWithUnit, "RequestedQuantity">;
export type CompletedQuantity = Branded<QuantityWithUnit, "CompletedQuantity">;
export type RejectedQuantity = Branded<QuantityWithUnit, "RejectedQuantity">;
export type ScrapQuantity = Branded<QuantityWithUnit, "ScrapQuantity">;
export type ReworkQuantity = Branded<QuantityWithUnit, "ReworkQuantity">;
export type RequiredMaterialQuantity = Branded<QuantityWithUnit, "RequiredMaterialQuantity">;
export type IssuedMaterialQuantity = Branded<QuantityWithUnit, "IssuedMaterialQuantity">;
export type ConsumedMaterialQuantity = Branded<QuantityWithUnit, "ConsumedMaterialQuantity">;
export type ReturnedMaterialQuantity = Branded<QuantityWithUnit, "ReturnedMaterialQuantity">;

export type YieldPercentage = Branded<number, "YieldPercentage">;
export type SequenceNumber = Branded<number, "SequenceNumber">;
export type DurationInMinutes = Branded<number, "DurationInMinutes">;
export type CycleTime = Branded<DurationInMinutes, "CycleTime">;
export type SetupTime = Branded<DurationInMinutes, "SetupTime">;
export type RunTime = Branded<DurationInMinutes, "RunTime">;
export type DowntimeDuration = Branded<DurationInMinutes, "DowntimeDuration">;
export type LaborDuration = Branded<DurationInMinutes, "LaborDuration">;
export type MachineDuration = Branded<DurationInMinutes, "MachineDuration">;

export type EffectiveDateRange = Readonly<{
  startAt: string;
  endAt: string;
}>;

export type ExecutionVersion = Branded<number, "ExecutionVersion">;

export type WorkOrderLifecycleState =
  | "DRAFT"
  | "PLANNED"
  | "RELEASED"
  | "READY"
  | "IN_PROGRESS"
  | "PAUSED"
  | "BLOCKED"
  | "ON_HOLD"
  | "PARTIALLY_COMPLETED"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED"
  | "ARCHIVED";

export type OperationLifecycleState =
  | "PENDING"
  | "READY"
  | "IN_PROGRESS"
  | "PAUSED"
  | "BLOCKED"
  | "REWORK_REQUIRED"
  | "COMPLETED"
  | "SKIPPED"
  | "FAILED"
  | "CANCELLED"
  | "CLOSED";

export type OperationEligibilityState = "ELIGIBLE" | "NOT_ELIGIBLE" | "DEFERRED";

export type MaterialRequirementLifecycleState =
  | "PLANNED"
  | "READY"
  | "PARTIALLY_ISSUED"
  | "ISSUED"
  | "PARTIALLY_CONSUMED"
  | "CONSUMED"
  | "RETURNED"
  | "CANCELLED";

export type ProductionStatus = Branded<string, "ProductionStatus">;
export type WorkInProgressStatus = Branded<string, "WorkInProgressStatus">;

export type ProductReference = Readonly<{
  tenantId: TenantId;
  productId: ProductIdentifier;
}>;

export type ProductVariantReference = Readonly<{
  tenantId: TenantId;
  productVariantId: ProductVariantIdentifier;
}>;

export type ProductVersionReference = Readonly<{
  tenantId: TenantId;
  productVersionId: ProductVersionIdentifier;
}>;

export type ProductBomReference = Readonly<{
  tenantId: TenantId;
  productBomId: ProductBomIdentifier;
  bomVersion: VersionIdentifier;
}>;

export type InventoryItemReference = Readonly<{
  tenantId: TenantId;
  inventoryItemId: InventoryItemIdentifier;
}>;

export type InventoryReservationReference = Readonly<{
  tenantId: TenantId;
  inventoryReservationId: InventoryReservationIdentifier;
}>;

export type InventoryAllocationReference = Readonly<{
  tenantId: TenantId;
  inventoryAllocationId: InventoryAllocationIdentifier;
}>;

export type InventoryMovementReference = Readonly<{
  tenantId: TenantId;
  inventoryMovementId: InventoryMovementIdentifier;
}>;

export type OrganizationReference = Readonly<{
  tenantId: TenantId;
  organizationId: OrganizationIdentifier;
}>;

export type PersonOrContactReference = Readonly<{
  tenantId: TenantId;
  personOrContactId: PersonOrContactIdentifier;
}>;

export type AssetReference = Readonly<{
  tenantId: TenantId;
  assetId: AssetIdentifier;
}>;

export type DocumentReference = Readonly<{
  tenantId: TenantId;
  documentId: DocumentIdentifier;
}>;

export type KnowledgeReference = Readonly<{
  tenantId: TenantId;
  knowledgeId: KnowledgeIdentifier;
}>;

export type CommerceOrderReference = Readonly<{
  tenantId: TenantId;
  commerceOrderId: CommerceOrderIdentifier;
}>;

export type FinanceClassificationReference = Readonly<{
  tenantId: TenantId;
  financeClassificationId: FinanceClassificationIdentifier;
}>;

export type ManufacturingInstructionReference = Readonly<{
  manufacturingInstructionReferenceId: Branded<string, "ManufacturingInstructionReferenceId">;
  tenantId: TenantId;
  targetIdentity: string;
  instructionDocument: DocumentReference;
  status: ProductionStatus;
}>;

export type QualityHoldReference = Readonly<{
  qualityHoldReferenceId: Branded<string, "QualityHoldReferenceId">;
  tenantId: TenantId;
  targetIdentity: string;
  holdCode: string;
  status: ProductionStatus;
}>;

export type ManufacturingMetadata = Readonly<{
  manufacturingMetadataId: Branded<string, "ManufacturingMetadataId">;
  tenantId: TenantId;
  ownerIdentity: string;
  metadata: MetadataCollection;
}>;

export type ManufacturingRelationship = Readonly<{
  manufacturingRelationshipId: Branded<string, "ManufacturingRelationshipId">;
  tenantId: TenantId;
  relationshipType: string;
  fromIdentity: string;
  toIdentity: string;
  effectiveRange?: EffectiveDateRange;
}>;

export type ProductionTraceSourceType =
  | "PRODUCT_VERSION"
  | "PRODUCT_BOM_VERSION"
  | "WORK_ORDER"
  | "PRODUCTION_RUN"
  | "PRODUCTION_BATCH"
  | "OPERATION"
  | "MATERIAL_REQUIREMENT"
  | "INVENTORY_RESERVATION"
  | "INVENTORY_ALLOCATION"
  | "INVENTORY_MOVEMENT"
  | "LOT"
  | "SERIAL"
  | "CONSUMPTION"
  | "OUTPUT"
  | "SCRAP"
  | "REWORK"
  | "MACHINE"
  | "LABOR"
  | "DOCUMENT"
  | "KNOWLEDGE"
  | "QUALITY_HOLD";

export type ProductionTraceRecord = Readonly<{
  productionTraceId: ProductionTraceId;
  tenantId: TenantId;
  correlationId: CorrelationIdentifier;
  sourceType: ProductionTraceSourceType;
  sourceId: string;
  targetType: ProductionTraceSourceType;
  targetId: string;
  occurredAt: string;
  metadata: MetadataCollection;
}>;

export type ProductionExecutionSnapshot = Readonly<{
  snapshotId: Branded<string, "ProductionExecutionSnapshotId">;
  tenantId: TenantId;
  targetIdentity: string;
  snapshotVersion: ExecutionVersion;
  capturedAt: string;
  payloadHash: string;
}>;

export type RoutingDependencyEdge = Readonly<{
  fromStepId: RoutingStepId;
  toStepId: RoutingStepId;
  edgeType: "STRUCTURAL" | "REWORK" | "CONDITIONAL";
}>;

export type RoutingConditionalEligibility = Readonly<{
  state: OperationEligibilityState;
  conditionCode?: Branded<string, "ConditionCode">;
  conditionInput?: MetadataCollection;
}>;

export type RoutingReworkEdge = Readonly<{
  targetStepId: RoutingStepId;
  maxIterations: number;
  reasonCode?: Branded<string, "ReworkReasonCode">;
}>;

export type RoutingTimingExpectation = Readonly<{
  setupTimeMinutes?: number;
  cycleTimeMinutes?: number;
  expectedDurationMinutes?: number;
}>;

export type RoutingStepExecutionState = Readonly<{
  readiness: "READY" | "BLOCKED" | "NOT_READY";
  operationState: OperationLifecycleState;
}>;

export type RoutingStep = Readonly<{
  routingStepId: RoutingStepId;
  tenantId: TenantId;
  operationExecutionId?: OperationExecutionId;
  operationCode?: OperationCode;
  routingStepCode: RoutingStepCode;
  sequenceNumber: SequenceNumber;
  predecessorStepIds: readonly RoutingStepId[];
  successorStepIds: readonly RoutingStepId[];
  conditionalEligibility?: RoutingConditionalEligibility;
  explicitReworkEdges?: readonly RoutingReworkEdge[];
  reworkStepIds: readonly RoutingStepId[];
  conditionalStepIds: readonly RoutingStepId[];
  requiredWorkCenterClass?: Branded<string, "WorkCenterClassCode">;
  requiredWorkCenterRef?: WorkCenterId;
  timingExpectation?: RoutingTimingExpectation;
  executionState?: RoutingStepExecutionState;
}>;

export type ExecutionRouting = Readonly<{
  executionRoutingId: ExecutionRoutingId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  sourceProductVersionRef?: ProductVersionReference;
  sourceBomRef?: ProductBomReference;
  sourceRoutingReference?: Branded<string, "ProductRoutingReferenceId">;
  status: ProductionStatus;
  steps: readonly RoutingStep[];
  version: number;
}>;

export type ManufacturingOperation = Readonly<{
  manufacturingOperationId: ManufacturingOperationId;
  tenantId: TenantId;
  operationCode: OperationCode;
  routingStepId: RoutingStepId;
  status: OperationLifecycleState;
}>;

export type OperationExecution = Readonly<{
  operationExecutionId: OperationExecutionId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  executionRoutingId: ExecutionRoutingId;
  routingStepId: RoutingStepId;
  operationCode: OperationCode;
  eligibility: OperationEligibilityState;
  operationState: OperationLifecycleState;
  plannedQuantity: PlannedQuantity;
  completedQuantity: CompletedQuantity;
  rejectedQuantity: RejectedQuantity;
  scrapQuantity: ScrapQuantity;
  reworkQuantity: ReworkQuantity;
  workCenterId?: WorkCenterId;
  productionCellId?: ProductionCellId;
  startedAt?: string;
  endedAt?: string;
  version: number;
}>;

export type ManufacturingWorkOrder = Readonly<{
  manufacturingWorkOrderId: ManufacturingWorkOrderId;
  workOrderNumber: WorkOrderNumber;
  tenantId: TenantId;
  productRef: ProductReference;
  productVariantRef?: ProductVariantReference;
  productVersionRef: ProductVersionReference;
  productBomRef: ProductBomReference;
  requestedQuantity: RequestedQuantity;
  plannedQuantity: PlannedQuantity;
  completedQuantity: CompletedQuantity;
  rejectedQuantity: RejectedQuantity;
  scrapQuantity: ScrapQuantity;
  reworkQuantity: ReworkQuantity;
  workOrderState: WorkOrderLifecycleState;
  executionRoutingId?: ExecutionRoutingId;
  productionStatus: ProductionStatus;
  workInProgressStatus: WorkInProgressStatus;
  externalDemandRef?: CommerceOrderReference;
  correlationId: CorrelationIdentifier;
  idempotencyKey: IdempotencyKey;
  version: number;
}>;

export type ProductionOrder = Readonly<{
  productionOrderId: ProductionOrderId;
  productionOrderNumber: ProductionOrderNumber;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  status: ProductionStatus;
  version: number;
}>;

export type ProductionRun = Readonly<{
  productionRunId: ProductionRunId;
  runCode: RunCode;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  status: ProductionStatus;
  version: number;
}>;

export type ProductionBatch = Readonly<{
  productionBatchId: ProductionBatchId;
  batchCode: BatchCode;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  productionRunId?: ProductionRunId;
  status: ProductionStatus;
  version: number;
}>;

export type ManufacturingJob = Readonly<{
  manufacturingJobId: ManufacturingJobId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  status: ProductionStatus;
  version: number;
}>;

export type WorkCenter = Readonly<{
  workCenterId: WorkCenterId;
  workCenterCode: WorkCenterCode;
  tenantId: TenantId;
  status: ProductionStatus;
  capacityUnits: number;
  version: number;
}>;

export type ProductionCell = Readonly<{
  productionCellId: ProductionCellId;
  productionCellCode: ProductionCellCode;
  tenantId: TenantId;
  workCenterId: WorkCenterId;
  status: ProductionStatus;
  capacityUnits: number;
  version: number;
}>;

export type MachineAssignment = Readonly<{
  machineAssignmentId: MachineAssignmentId;
  tenantId: TenantId;
  operationExecutionId: OperationExecutionId;
  machineRef: AssetReference;
  effectiveRange?: EffectiveDateRange;
  machineDuration?: MachineDuration;
  version: number;
}>;

export type ToolAssignment = Readonly<{
  toolAssignmentId: ToolAssignmentId;
  tenantId: TenantId;
  operationExecutionId: OperationExecutionId;
  toolRef: AssetReference;
  effectiveRange?: EffectiveDateRange;
  version: number;
}>;

export type LaborAssignment = Readonly<{
  laborAssignmentId: LaborAssignmentId;
  tenantId: TenantId;
  operationExecutionId: OperationExecutionId;
  laborRef: PersonOrContactReference;
  roleCode: string;
  effectiveRange?: EffectiveDateRange;
  laborDuration?: LaborDuration;
  version: number;
}>;

export type MaterialRequirement = Readonly<{
  materialRequirementId: MaterialRequirementId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  productVersionRef: ProductVersionReference;
  productBomRef: ProductBomReference;
  inventoryItemRef: InventoryItemReference;
  requiredQuantity: RequiredMaterialQuantity;
  issuedQuantity: IssuedMaterialQuantity;
  consumedQuantity: ConsumedMaterialQuantity;
  returnedQuantity: ReturnedMaterialQuantity;
  requiredByOperationId?: OperationExecutionId;
  reservationRefs: readonly InventoryReservationReference[];
  allocationRefs: readonly InventoryAllocationReference[];
  status: ProductionStatus;
  version: number;
}>;

export type MaterialSubstitutionPolicy = Readonly<{
  substitutionFamily?: Branded<string, "SubstitutionFamilyIdentifier">;
  approvedSubstituteProductId?: ProductIdentifier;
  approvedSubstituteInventoryItemId?: InventoryItemIdentifier;
  reason?: Branded<string, "SubstitutionReasonCode">;
  approvalEvidence?: MetadataCollection;
}>;

export type MaterialVariancePolicy = Readonly<{
  allowedOveragePercent?: number;
  allowedUnderagePercent?: number;
  notes?: MetadataCollection;
}>;

export type MaterialRequirementExecutionRecord = Readonly<{
  materialRequirementId: MaterialRequirementId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  bomId: ProductBomIdentifier;
  bomVersion: VersionIdentifier;
  bomLineId: BomLineIdentifier;
  componentProductRef?: ProductReference;
  inventoryItemRef?: InventoryItemReference;
  requiredQuantity: RequiredMaterialQuantity;
  issuedQuantity: IssuedMaterialQuantity;
  consumedQuantity: ConsumedMaterialQuantity;
  returnedQuantity: ReturnedMaterialQuantity;
  reservationRefs: readonly InventoryReservationReference[];
  allocationRefs: readonly InventoryAllocationReference[];
  scrapQuantity?: ScrapQuantity;
  unitOfMeasure: UnitOfMeasure;
  requiredByOperationId?: OperationExecutionId;
  requiredByRoutingStepId?: RoutingStepId;
  substitutionPolicy?: MaterialSubstitutionPolicy;
  variancePolicy?: MaterialVariancePolicy;
  status: MaterialRequirementLifecycleState;
  correlationId: CorrelationIdentifier;
  metadata?: MetadataCollection;
  version: number;
}>;

export type MaterialIssueRequest = Readonly<{
  materialIssueRequestId: MaterialIssueRequestId;
  tenantId: TenantId;
  materialRequirementId: MaterialRequirementId;
  inventoryItemRef: InventoryItemReference;
  requestQuantity: RequiredMaterialQuantity;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  status: ProductionStatus;
  version: number;
}>;

export type MaterialIssueLifecycleState =
  | "REQUESTED"
  | "PARTIALLY_ISSUED"
  | "ISSUED"
  | "REJECTED"
  | "RECONCILIATION_REQUIRED";

export type MaterialIssueCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  materialRequirementId: MaterialRequirementId;
  inventoryItemRef: InventoryItemReference;
  quantity: number;
  unitOfMeasure: UnitOfMeasure;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  expectedRequirementVersion?: number;
  operationExecutionId?: OperationExecutionId;
  metadata?: MetadataCollection;
}>;

export type MaterialIssueExecutionRecord = Readonly<{
  materialIssueRequestId: MaterialIssueRequestId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  materialRequirementId: MaterialRequirementId;
  inventoryItemRef: InventoryItemReference;
  requestedQuantity: number;
  acceptedQuantity: number;
  unitOfMeasure: UnitOfMeasure;
  status: MaterialIssueLifecycleState;
  inventoryReferenceId?: string;
  reason?: string;
  reasonCode?: string;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: MetadataCollection;
  version: number;
}>;

export type MaterialConsumptionRecord = Readonly<{
  materialConsumptionId: MaterialConsumptionId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId: OperationExecutionId;
  materialRequirementId: MaterialRequirementId;
  consumedQuantity: ConsumedMaterialQuantity;
  movementRef?: InventoryMovementReference;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  recordedAt: string;
  version: number;
}>;

export type MaterialConsumptionLifecycleState = "RECORDED" | "REJECTED" | "RECONCILIATION_REQUIRED";

export type MaterialConsumptionCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId: OperationExecutionId;
  materialRequirementId: MaterialRequirementId;
  consumedQuantity: number;
  unitOfMeasure: UnitOfMeasure;
  inventoryMovementId?: string;
  inventoryItemRef?: InventoryItemReference;
  lotId?: string;
  serialId?: string;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  allowOverConsumption?: boolean;
  metadata?: MetadataCollection;
}>;

export type MaterialConsumptionExecutionRecord = Readonly<{
  materialConsumptionId: MaterialConsumptionId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId: OperationExecutionId;
  materialRequirementId: MaterialRequirementId;
  consumedQuantity: number;
  unitOfMeasure: UnitOfMeasure;
  inventoryMovementId?: string;
  lotId?: string;
  serialId?: string;
  status: MaterialConsumptionLifecycleState;
  reason?: string;
  reasonCode?: string;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: MetadataCollection;
  recordedAt: string;
  version: number;
}>;

export type MaterialReturnCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  materialRequirementId: MaterialRequirementId;
  inventoryItemRef: InventoryItemReference;
  returnQuantity: number;
  unitOfMeasure: UnitOfMeasure;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: MetadataCollection;
}>;

export type MaterialReturnExecutionRecord = Readonly<{
  materialIssueRequestId: MaterialIssueRequestId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  materialRequirementId: MaterialRequirementId;
  inventoryItemRef: InventoryItemReference;
  returnedQuantity: number;
  unitOfMeasure: UnitOfMeasure;
  status: "RETURNED" | "REJECTED" | "RECONCILIATION_REQUIRED";
  inventoryReferenceId?: string;
  reason?: string;
  reasonCode?: string;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  metadata?: MetadataCollection;
  version: number;
}>;

export type MaterialExecutionSummary = Readonly<{
  materialRequirementId: MaterialRequirementId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  requiredQuantity: number;
  issuedQuantity: number;
  consumedQuantity: number;
  returnedQuantity: number;
  remainingToIssue: number;
  remainingToConsume: number;
  varianceQuantity: number;
  inventoryReservationIds: readonly string[];
  inventoryAllocationIds: readonly string[];
  issueStatus: "NONE" | "PARTIAL" | "COMPLETE";
  consumptionStatus: "NONE" | "PARTIAL" | "COMPLETE" | "OVER_CONSUMED";
  reconciliationRequired: boolean;
}>;

export type ProductionOutputRecord = Readonly<{
  productionOutputId: ProductionOutputId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId?: OperationExecutionId;
  productRef: ProductReference;
  quantity: CompletedQuantity;
  disposition: "COMPLETED" | "REJECTED" | "SCRAP" | "REWORK" | "BYPRODUCT" | "WIP";
  inventoryMovementRef?: InventoryMovementReference;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  recordedAt: string;
  version: number;
}>;

export type ScrapRecord = Readonly<{
  scrapRecordId: ScrapRecordId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId?: OperationExecutionId;
  quantity: ScrapQuantity;
  reasonCode: string;
  outputRef?: ProductionOutputId;
  version: number;
}>;

export type ReworkRecord = Readonly<{
  reworkRecordId: ReworkRecordId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  sourceOutputRef: ProductionOutputId;
  quantity: ReworkQuantity;
  targetOperationExecutionId?: OperationExecutionId;
  reasonCode: string;
  status: ProductionStatus;
  version: number;
}>;

export type YieldRecord = Readonly<{
  yieldRecordId: YieldRecordId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  yieldPercentage: YieldPercentage;
  basis: "DERIVED" | "RECORDED";
  version: number;
}>;

export type DowntimeRecord = Readonly<{
  downtimeRecordId: DowntimeRecordId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId?: OperationExecutionId;
  workCenterId?: WorkCenterId;
  machineRef?: AssetReference;
  startedAt: string;
  endedAt?: string;
  reasonCode: string;
  category: string;
  duration?: DowntimeDuration;
  version: number;
}>;

export type ExecutionException = Readonly<{
  executionExceptionId: ExecutionExceptionId;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  operationExecutionId?: OperationExecutionId;
  category: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: ProductionStatus;
  detectedAt: string;
  version: number;
}>;

export type WorkInProgressState = Readonly<{
  wipStateId: Branded<string, "WorkInProgressStateId">;
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrderId;
  currentOperationExecutionId?: OperationExecutionId;
  quantityWaiting: RequestedQuantity;
  quantityInProcess: PlannedQuantity;
  quantityCompleted: CompletedQuantity;
  quantityRejected: RejectedQuantity;
  holdState: ProductionStatus;
  currentWorkCenterId?: WorkCenterId;
  status: WorkInProgressStatus;
  version: number;
}>;

export type ManufacturingFailureClassification =
  | "INVALID_COMMAND"
  | "INVALID_IDENTIFIER"
  | "TENANT_MISMATCH"
  | "DUPLICATE_IDENTITY"
  | "DUPLICATE_BUSINESS_IDENTIFIER"
  | "INVALID_LIFECYCLE_TRANSITION"
  | "STALE_EXPECTED_VERSION"
  | "CONFLICTING_IDEMPOTENCY_PAYLOAD"
  | "INVALID_QUANTITY"
  | "ROUTING_STRUCTURAL_CYCLE"
  | "INVALID_ROUTING_STEP"
  | "INVALID_OPERATION_STATE"
  | "OPERATION_PREREQUISITE_FAILURE"
  | "INVALID_MATERIAL_REQUIREMENT"
  | "INVALID_OUTPUT"
  | "INVALID_WIP_STATE"
  | "INVALID_RESOURCE_ASSIGNMENT"
  | "INVALID_DOWNTIME"
  | "TRACEABILITY_VIOLATION"
  | "INVALID_EXTERNAL_REFERENCE"
  | "ATOMICITY_FAILURE"
  | "DUPLICATE_WORK_ORDER_ID"
  | "DUPLICATE_WORK_ORDER_NUMBER"
  | "INVALID_WORK_ORDER_REFERENCE"
  | "INVALID_WORK_ORDER_QUANTITY"
  | "WORK_ORDER_NOT_READY"
  | "PRODUCT_BASELINE_NOT_READY"
  | "ROUTING_NOT_READY"
  | "MATERIALS_NOT_READY"
  | "RESOURCES_NOT_READY"
  | "DUPLICATE_PRODUCTION_RUN_ID"
  | "DUPLICATE_RUN_CODE"
  | "INVALID_PRODUCTION_RUN"
  | "DUPLICATE_PRODUCTION_BATCH_ID"
  | "DUPLICATE_BATCH_CODE"
  | "INVALID_PRODUCTION_BATCH"
  | "TERMINAL_WORK_ORDER_MUTATION"
  | "DUPLICATE_ROUTING_ID"
  | "DUPLICATE_ROUTING_STEP_ID"
  | "DUPLICATE_OPERATION_EXECUTION_ID"
  | "ROUTING_SELF_CYCLE"
  | "INVALID_ROUTING_REFERENCE"
  | "INVALID_ROUTING_DEPENDENCY"
  | "INVALID_ROUTING_SEQUENCE"
  | "OPERATION_NOT_ELIGIBLE"
  | "INVALID_OPERATION_TRANSITION"
  | "TERMINAL_OPERATION_MUTATION"
  | "INVALID_REWORK_EDGE"
  | "REWORK_LIMIT_EXCEEDED"
  | "DUPLICATE_OPERATION_COMMAND"
  | "PRODUCT_REFERENCE_INVALID"
  | "PRODUCT_VARIANT_INVALID"
  | "PRODUCT_VERSION_INVALID"
  | "PRODUCT_BOM_INVALID"
  | "PRODUCT_BASELINE_NOT_VALIDATED"
  | "PRODUCT_BASELINE_ALREADY_FROZEN"
  | "PRODUCT_BASELINE_DRIFT"
  | "BOM_LINE_INVALID"
  | "MATERIAL_REQUIREMENT_DERIVATION_FAILURE"
  | "DUPLICATE_MATERIAL_REQUIREMENT"
  | "INVALID_REQUIREMENT_QUANTITY"
  | "INVALID_REQUIREMENT_UOM"
  | "INVALID_REQUIREMENT_OPERATION_REFERENCE"
  | "INVALID_SUBSTITUTION"
  | "MATERIAL_REQUIREMENT_NOT_READY"
  | "INVENTORY_AVAILABILITY_REJECTED"
  | "INVENTORY_RESERVATION_REJECTED"
  | "INVENTORY_ALLOCATION_REJECTED"
  | "INVENTORY_ISSUE_REJECTED"
  | "INVENTORY_RETURN_REJECTED"
  | "INVENTORY_MOVEMENT_INVALID"
  | "INVENTORY_LOT_INVALID"
  | "INVENTORY_SERIAL_INVALID"
  | "INSUFFICIENT_INVENTORY"
  | "MATERIAL_CONSUMPTION_EXCEEDS_ISSUED"
  | "MATERIAL_CONSUMPTION_EXCEEDS_REQUIRED"
  | "MATERIAL_ISSUE_REQUIRES_RECONCILIATION"
  | "MATERIAL_CONSUMPTION_REQUIRES_RECONCILIATION"
  | "MATERIAL_RETURN_REQUIRES_RECONCILIATION";

export const MANUFACTURING_FAILURE_CLASSIFICATIONS: readonly ManufacturingFailureClassification[] = [
  "INVALID_COMMAND",
  "INVALID_IDENTIFIER",
  "TENANT_MISMATCH",
  "DUPLICATE_IDENTITY",
  "DUPLICATE_BUSINESS_IDENTIFIER",
  "INVALID_LIFECYCLE_TRANSITION",
  "STALE_EXPECTED_VERSION",
  "CONFLICTING_IDEMPOTENCY_PAYLOAD",
  "INVALID_QUANTITY",
  "ROUTING_STRUCTURAL_CYCLE",
  "INVALID_ROUTING_STEP",
  "INVALID_OPERATION_STATE",
  "OPERATION_PREREQUISITE_FAILURE",
  "INVALID_MATERIAL_REQUIREMENT",
  "INVALID_OUTPUT",
  "INVALID_WIP_STATE",
  "INVALID_RESOURCE_ASSIGNMENT",
  "INVALID_DOWNTIME",
  "TRACEABILITY_VIOLATION",
  "INVALID_EXTERNAL_REFERENCE",
  "ATOMICITY_FAILURE",
  "DUPLICATE_WORK_ORDER_ID",
  "DUPLICATE_WORK_ORDER_NUMBER",
  "INVALID_WORK_ORDER_REFERENCE",
  "INVALID_WORK_ORDER_QUANTITY",
  "WORK_ORDER_NOT_READY",
  "PRODUCT_BASELINE_NOT_READY",
  "ROUTING_NOT_READY",
  "MATERIALS_NOT_READY",
  "RESOURCES_NOT_READY",
  "DUPLICATE_PRODUCTION_RUN_ID",
  "DUPLICATE_RUN_CODE",
  "INVALID_PRODUCTION_RUN",
  "DUPLICATE_PRODUCTION_BATCH_ID",
  "DUPLICATE_BATCH_CODE",
  "INVALID_PRODUCTION_BATCH",
  "TERMINAL_WORK_ORDER_MUTATION",
  "DUPLICATE_ROUTING_ID",
  "DUPLICATE_ROUTING_STEP_ID",
  "DUPLICATE_OPERATION_EXECUTION_ID",
  "ROUTING_SELF_CYCLE",
  "INVALID_ROUTING_REFERENCE",
  "INVALID_ROUTING_DEPENDENCY",
  "INVALID_ROUTING_SEQUENCE",
  "OPERATION_NOT_ELIGIBLE",
  "INVALID_OPERATION_TRANSITION",
  "TERMINAL_OPERATION_MUTATION",
  "INVALID_REWORK_EDGE",
  "REWORK_LIMIT_EXCEEDED",
  "DUPLICATE_OPERATION_COMMAND",
  "PRODUCT_REFERENCE_INVALID",
  "PRODUCT_VARIANT_INVALID",
  "PRODUCT_VERSION_INVALID",
  "PRODUCT_BOM_INVALID",
  "PRODUCT_BASELINE_NOT_VALIDATED",
  "PRODUCT_BASELINE_ALREADY_FROZEN",
  "PRODUCT_BASELINE_DRIFT",
  "BOM_LINE_INVALID",
  "MATERIAL_REQUIREMENT_DERIVATION_FAILURE",
  "DUPLICATE_MATERIAL_REQUIREMENT",
  "INVALID_REQUIREMENT_QUANTITY",
  "INVALID_REQUIREMENT_UOM",
  "INVALID_REQUIREMENT_OPERATION_REFERENCE",
  "INVALID_SUBSTITUTION",
  "MATERIAL_REQUIREMENT_NOT_READY",
  "INVENTORY_AVAILABILITY_REJECTED",
  "INVENTORY_RESERVATION_REJECTED",
  "INVENTORY_ALLOCATION_REJECTED",
  "INVENTORY_ISSUE_REJECTED",
  "INVENTORY_RETURN_REJECTED",
  "INVENTORY_MOVEMENT_INVALID",
  "INVENTORY_LOT_INVALID",
  "INVENTORY_SERIAL_INVALID",
  "INSUFFICIENT_INVENTORY",
  "MATERIAL_CONSUMPTION_EXCEEDS_ISSUED",
  "MATERIAL_CONSUMPTION_EXCEEDS_REQUIRED",
  "MATERIAL_ISSUE_REQUIRES_RECONCILIATION",
  "MATERIAL_CONSUMPTION_REQUIRES_RECONCILIATION",
  "MATERIAL_RETURN_REQUIRES_RECONCILIATION",
];

export type IdempotencyCommandFamily =
  | "WORK_ORDER"
  | "OPERATION"
  | "MATERIAL"
  | "CONSUMPTION"
  | "OUTPUT"
  | "SCRAP"
  | "REWORK"
  | "ASSIGNMENT"
  | "DOWNTIME";

export type IdempotencyRecord = Readonly<{
  tenantId: TenantId;
  commandFamily: IdempotencyCommandFamily;
  key: IdempotencyKey;
  payloadFingerprint: string;
  acceptedResultIdentity?: string;
  classification: "ACCEPTED" | "REPLAY" | "CONFLICT";
}>;
