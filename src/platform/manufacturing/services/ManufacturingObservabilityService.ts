import {
  ObservationPublisher,
  ObserverRegistry,
  compareDeterministicStrings,
} from "../../shared";
import type { TenantId } from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingRuntimeDependencies } from "../integration";
import type { ManufacturingRuntimeState } from "../runtime";
import type { ManufacturingMaterialExecutionQueryService } from "../queries/ManufacturingMaterialExecutionQueryService";
import type { ManufacturingProductionResultQueryService } from "../queries/ManufacturingProductionResultQueryService";
import type { ManufacturingResourceQueryService } from "../queries/ManufacturingResourceQueryService";
import type { ManufacturingTraceabilityQueryService } from "../queries/ManufacturingTraceabilityQueryService";
import type { ExecutionRoutingService } from "./ExecutionRoutingService";
import type { ManufacturingAuditCategory, ManufacturingAuditEvent, ManufacturingAuditService } from "./ManufacturingAuditService";
import type {
  ManufacturingReferenceHealth,
  ManufacturingReferenceValidationMetrics,
  ManufacturingReferenceValidationService,
} from "./ManufacturingReferenceValidationService";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";
import type { MaterialRequirementService } from "./MaterialRequirementService";
import type { MaterialIssueService } from "./MaterialIssueService";
import type { MaterialConsumptionService } from "./MaterialConsumptionService";

export type ManufacturingHealthCategory = "HEALTHY" | "DEGRADED" | "UNHEALTHY";

export type ManufacturingHealthReasonCode =
  | "HEALTH_CHECK_OK"
  | "RUNTIME_NOT_READY"
  | "RUNTIME_PARTIAL_INITIALIZATION"
  | "MISSING_MANDATORY_PRODUCT_VALIDATOR"
  | "MISSING_MANDATORY_INVENTORY_INTEGRATION"
  | "OPTIONAL_VALIDATOR_UNAVAILABLE"
  | "INVALID_PRODUCT_BASELINE_REFERENCE"
  | "INVALID_INVENTORY_MOVEMENT_REFERENCE"
  | "TRACEABILITY_VIOLATION"
  | "RECONCILIATION_REQUIRED"
  | "RESOURCE_INTEGRITY_FAILURE"
  | "ROUTING_INTEGRITY_FAILURE"
  | "AUDIT_SINK_UNAVAILABLE"
  | "OBSERVATION_SINK_UNAVAILABLE"
  | "LIFECYCLE_STOP_FAILURE"
  | "PERSISTENCE_NOT_IMPLEMENTED"
  | "HEALTH_INVARIANT_FAILURE"
  | "INFORMATIONAL";

export type ManufacturingHealthSubsystem =
  | "runtime-readiness"
  | "provider-registration"
  | "service-registration"
  | "product-integration"
  | "inventory-integration"
  | "external-validator-availability"
  | "work-order-invariants"
  | "routing-integrity"
  | "operation-integrity"
  | "material-requirement-integrity"
  | "inventory-interaction-reconciliation"
  | "output-reconciliation"
  | "wip-integrity"
  | "resource-readiness-consistency"
  | "downtime-integrity"
  | "traceability-integrity"
  | "idempotency-integrity"
  | "concurrency-conflict-pressure"
  | "audit-sink"
  | "observation-sink"
  | "persistence-recovery";

export type ManufacturingHealthCheck = Readonly<{
  subsystem: ManufacturingHealthSubsystem;
  status: "PASS" | "WARN" | "FAIL";
  category: ManufacturingHealthCategory;
  reasonCode: ManufacturingHealthReasonCode;
  detail: string;
  required: boolean;
}>;

export type ManufacturingHealthSnapshot = Readonly<{
  status: ManufacturingHealthCategory;
  generatedAt: string;
  checks: readonly ManufacturingHealthCheck[];
}>;

export type ManufacturingMetricClassification = "COUNTER" | "GAUGE" | "DERIVED_PROJECTION";

export type ManufacturingMetricsSnapshot = Readonly<{
  generatedAt: string;
  classification: Readonly<Record<string, ManufacturingMetricClassification>>;
  values: Readonly<{
    workOrderCount: number;
    activeWorkOrderCount: number;
    completedWorkOrderCount: number;
    blockedWorkOrderCount: number;
    routingCount: number;
    operationCount: number;
    activeOperationCount: number;
    completedOperationCount: number;
    blockedOperationCount: number;
    reworkOperationCount: number;
    materialRequirementCount: number;
    materialIssueRequestCount: number;
    materialConsumptionRecordCount: number;
    materialReturnCount: number;
    materialReconciliationRequiredCount: number;
    productionOutputCount: number;
    finishedOutputCount: number;
    intermediateOutputCount: number;
    outputReconciliationRequiredCount: number;
    scrapRecordCount: number;
    scrapQuantity: number;
    reworkRecordCount: number;
    reworkQuantity: number;
    yieldProjection: number;
    wipQuantity: number;
    wipWorkOrderCount: number;
    workCenterCount: number;
    productionCellCount: number;
    machineAssignmentCount: number;
    toolAssignmentCount: number;
    laborAssignmentCount: number;
    resourceConflictCount: number;
    downtimeRecordCount: number;
    downtimeDuration: number;
    openExecutionExceptionCount: number;
    qualityHoldCount: number;
    traceRecordCount: number;
    traceRejectionCount: number;
    referenceValidationCount: number;
    referenceValidationFailureCount: number;
    mandatoryReferenceFailureCount: number;
    optionalReferenceFailureCount: number;
    missingValidatorCount: number;
    tenantMismatchCount: number;
    staleReferenceCount: number;
    staleVersionCount: number;
    idempotentReplayCount: number;
    idempotencyConflictCount: number;
    productIntegrationFailureCount: number;
    inventoryIntegrationFailureCount: number;
    externalAcceptedLocalCommitFailureCount: number;
    startupFailureCount: number;
    shutdownFailureCount: number;
    observationPublishFailureCount: number;
  }>;
}>;

export type ManufacturingRuntimeReadinessProjection = Readonly<{
  runtimeId: string;
  phase: ManufacturingRuntimeState["phase"];
  ready: boolean;
  providerCount: number;
  serviceCount: number;
  integrationCount: number;
  partialInitialization: boolean;
  lastFailureCode?: string;
}>;

export type ManufacturingMissionControlObservation = Readonly<{
  platformIdentifier: "platform.manufacturing";
  schemaVersion: "1.0.0";
  runtimeState: ManufacturingRuntimeReadinessProjection;
  readiness: boolean;
  overallHealth: ManufacturingHealthCategory;
  subsystemHealth: readonly ManufacturingHealthCheck[];
  metricsSnapshot: ManufacturingMetricsSnapshot;
  workOrderSummary: Readonly<{
    total: number;
    active: number;
    completed: number;
    blocked: number;
  }>;
  operationSummary: Readonly<{
    total: number;
    active: number;
    completed: number;
    blocked: number;
    rework: number;
  }>;
  wipSummary: Readonly<{
    quantity: number;
    workOrderCount: number;
  }>;
  downtimeSummary: Readonly<{
    recordCount: number;
    durationMinutes: number;
  }>;
  yieldProjection: number;
  reconciliationSummary: Readonly<{
    materialReconciliationRequiredCount: number;
    outputReconciliationRequiredCount: number;
  }>;
  referenceHealthSummary: ManufacturingReferenceHealth;
  timestamp: string;
  contractVersion: string;
  reasonCodes: readonly ManufacturingHealthReasonCode[];
}>;

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function createMetricClassification(): Readonly<Record<string, ManufacturingMetricClassification>> {
  return {
    workOrderCount: "GAUGE",
    activeWorkOrderCount: "GAUGE",
    completedWorkOrderCount: "GAUGE",
    blockedWorkOrderCount: "GAUGE",
    routingCount: "GAUGE",
    operationCount: "GAUGE",
    activeOperationCount: "GAUGE",
    completedOperationCount: "GAUGE",
    blockedOperationCount: "GAUGE",
    reworkOperationCount: "GAUGE",
    materialRequirementCount: "GAUGE",
    materialIssueRequestCount: "GAUGE",
    materialConsumptionRecordCount: "GAUGE",
    materialReturnCount: "GAUGE",
    materialReconciliationRequiredCount: "GAUGE",
    productionOutputCount: "GAUGE",
    finishedOutputCount: "GAUGE",
    intermediateOutputCount: "GAUGE",
    outputReconciliationRequiredCount: "GAUGE",
    scrapRecordCount: "GAUGE",
    scrapQuantity: "GAUGE",
    reworkRecordCount: "GAUGE",
    reworkQuantity: "GAUGE",
    yieldProjection: "DERIVED_PROJECTION",
    wipQuantity: "GAUGE",
    wipWorkOrderCount: "GAUGE",
    workCenterCount: "GAUGE",
    productionCellCount: "GAUGE",
    machineAssignmentCount: "GAUGE",
    toolAssignmentCount: "GAUGE",
    laborAssignmentCount: "GAUGE",
    resourceConflictCount: "COUNTER",
    downtimeRecordCount: "GAUGE",
    downtimeDuration: "GAUGE",
    openExecutionExceptionCount: "GAUGE",
    qualityHoldCount: "GAUGE",
    traceRecordCount: "GAUGE",
    traceRejectionCount: "COUNTER",
    referenceValidationCount: "COUNTER",
    referenceValidationFailureCount: "COUNTER",
    mandatoryReferenceFailureCount: "COUNTER",
    optionalReferenceFailureCount: "COUNTER",
    missingValidatorCount: "COUNTER",
    tenantMismatchCount: "COUNTER",
    staleReferenceCount: "COUNTER",
    staleVersionCount: "COUNTER",
    idempotentReplayCount: "COUNTER",
    idempotencyConflictCount: "COUNTER",
    productIntegrationFailureCount: "COUNTER",
    inventoryIntegrationFailureCount: "COUNTER",
    externalAcceptedLocalCommitFailureCount: "COUNTER",
    startupFailureCount: "COUNTER",
    shutdownFailureCount: "COUNTER",
    observationPublishFailureCount: "COUNTER",
  };
}

function createRuntimeReadinessProjection(state?: ManufacturingRuntimeState): ManufacturingRuntimeReadinessProjection {
  return {
    runtimeId: state?.runtimeId ?? "manufacturing-runtime-unbound",
    phase: state?.phase ?? "CREATED",
    ready: state?.ready ?? false,
    providerCount: state?.providerIds.length ?? 0,
    serviceCount: state?.serviceIds.length ?? 0,
    integrationCount: state?.integrationIds.length ?? 0,
    partialInitialization: state?.phase === "FAILED" || (state ? !state.ready && state.phase !== "STOPPED" : true),
    lastFailureCode: state?.lastFailure?.code,
  };
}

export class ManufacturingMetricsService {
  private static readonly CLASSIFICATION = createMetricClassification();
  private observationPublishFailureCount = 0;

  constructor(
    private readonly dependencies: {
      runtimeDependencies: ManufacturingRuntimeDependencies;
      runtimeStateProvider: () => ManufacturingRuntimeState | undefined;
      auditService: ManufacturingAuditService;
      referenceService: ManufacturingReferenceValidationService;
      workOrders: ManufacturingWorkOrderService;
      routings: ExecutionRoutingService;
      operations: OperationExecutionService;
      materials: MaterialRequirementService;
      issues: MaterialIssueService;
      consumption: MaterialConsumptionService;
      materialExecutionQueries: ManufacturingMaterialExecutionQueryService;
      resultQueries: ManufacturingProductionResultQueryService;
      resourceQueries: ManufacturingResourceQueryService;
      traceQueries: ManufacturingTraceabilityQueryService;
    },
  ) {}

  recordObservationPublishFailure(): void {
    this.observationPublishFailureCount += 1;
  }

  private countAudit(predicate: (event: ManufacturingAuditEvent) => boolean): number {
    return this.dependencies.auditService.listManufacturingAuditEvents().filter(predicate).length;
  }

  private gatherTenantIds(explicitTenant?: TenantId): TenantId[] {
    if (explicitTenant) {
      return [explicitTenant];
    }
    return this.dependencies.auditService.getKnownTenantIds();
  }

  snapshot(tenantId?: TenantId): ManufacturingMetricsSnapshot {
    const tenantIds = this.gatherTenantIds(tenantId);

    const workOrders = tenantIds.flatMap((id) => this.dependencies.workOrders.listWorkOrders(id));
    const routings = tenantIds.flatMap((id) => this.dependencies.routings.listExecutionRoutings(id));
    const operations = workOrders.flatMap((order) =>
      this.dependencies.operations.listOperationsByWorkOrder(order.workOrder.tenantId, order.workOrder.manufacturingWorkOrderId),
    );
    const materialRequirements = tenantIds.flatMap((id) => this.dependencies.materials.listMaterialRequirements(id));

    let materialIssueRequestCount = 0;
    let materialConsumptionRecordCount = 0;
    let materialReturnCount = 0;
    let materialReconciliationRequiredCount = 0;
    for (const requirement of materialRequirements) {
      const requirementId = requirement.materialRequirementId as string;
      const issues = this.dependencies.issues.listIssueRecordsByRequirement(requirement.tenantId, requirementId);
      const returns = this.dependencies.issues.listReturnRecordsByRequirement(requirement.tenantId, requirementId);
      const consumption = this.dependencies.consumption.listConsumptionRecordsByRequirement(requirement.tenantId, requirementId);
      materialIssueRequestCount += issues.length;
      materialReturnCount += returns.length;
      materialConsumptionRecordCount += consumption.length;
      materialReconciliationRequiredCount += issues.filter((entry) => entry.status === "RECONCILIATION_REQUIRED").length;
      materialReconciliationRequiredCount += returns.filter((entry) => entry.status === "RECONCILIATION_REQUIRED").length;
      materialReconciliationRequiredCount += consumption.filter((entry) => entry.status === "RECONCILIATION_REQUIRED").length;
    }

    const outputs = tenantIds.flatMap((id) => this.dependencies.resultQueries.listProductionOutputs(id));
    const outputReconciliationRequiredCount = outputs.filter((entry) => entry.status === "RECONCILIATION_REQUIRED").length;

    const scrapByWorkOrder = workOrders.flatMap((order) =>
      this.dependencies.resultQueries.listScrapByWorkOrder(order.workOrder.tenantId, order.workOrder.manufacturingWorkOrderId),
    );
    const reworkByWorkOrder = workOrders.flatMap((order) =>
      this.dependencies.resultQueries.listReworkByWorkOrder(order.workOrder.tenantId, order.workOrder.manufacturingWorkOrderId),
    );

    const scrapQuantity = round(scrapByWorkOrder.reduce((sum, entry) => sum + entry.quantity, 0));
    const reworkQuantity = round(reworkByWorkOrder.reduce((sum, entry) => sum + entry.quantity, 0));

    const wipStates = tenantIds.flatMap((id) => this.dependencies.resultQueries.listWipByWorkOrder(id));
    const wipQuantity = round(
      wipStates.reduce((sum, state) => sum + state.quantityInProcess.value + state.quantityWaiting.value, 0),
    );

    const workCenters = tenantIds.flatMap((id) => this.dependencies.resourceQueries.listWorkCenters(id));
    const productionCells = tenantIds.flatMap((id) => this.dependencies.resourceQueries.listProductionCells(id));
    const machineAssignments = tenantIds.flatMap((id) => this.dependencies.resourceQueries.listMachineAssignments(id));
    const toolAssignments = operations.flatMap((operation) =>
      this.dependencies.resourceQueries.listToolAssignmentsByOperation(
        operation.execution.tenantId,
        operation.execution.operationExecutionId as string,
      ),
    );
    const laborAssignments = operations.flatMap((operation) =>
      this.dependencies.resourceQueries.listLaborAssignmentsByOperation(
        operation.execution.tenantId,
        operation.execution.operationExecutionId as string,
      ),
    );

    const downtimeByWorkOrder = workOrders.flatMap((order) =>
      this.dependencies.resourceQueries.listDowntimeByWorkOrder(order.workOrder.tenantId, order.workOrder.manufacturingWorkOrderId),
    );
    const downtimeDuration = round(
      downtimeByWorkOrder.reduce((sum, entry) => sum + (entry.duration ?? 0), 0),
    );

    const executionExceptions = tenantIds.flatMap((id) => this.dependencies.resourceQueries.listExecutionExceptions(id));
    const openExecutionExceptionCount = executionExceptions.filter((entry) => entry.status === "OPEN").length;
    const qualityHoldCount = executionExceptions.filter((entry) => entry.status === "OPEN" && Boolean(entry.qualityHoldRef)).length;

    const traceRecords = tenantIds.flatMap((id) => this.dependencies.traceQueries.listProductionTrace(id));

    const referenceMetrics: ManufacturingReferenceValidationMetrics = this.dependencies.referenceService.getMetrics();

    const staleVersionCount = this.countAudit((event) => (event.rejectionClassification ?? "").startsWith("STALE_"));
    const idempotentReplayCount = this.countAudit((event) =>
      event.record.eventType.includes("replay") || event.record.message.toLowerCase().includes("replay"),
    );
    const idempotencyConflictCount = this.countAudit(
      (event) => event.rejectionClassification === "CONFLICTING_IDEMPOTENCY_PAYLOAD",
    );

    const resourceConflictCount = this.countAudit((event) =>
      (event.rejectionClassification ?? "").includes("ASSIGNMENT_CONFLICT") ||
      (event.rejectionClassification ?? "").includes("_CONFLICT"),
    );

    const traceRejectionCount = this.countAudit(
      (event) => event.category === "TRACEABILITY" && event.record.eventType.includes("rejected"),
    );

    const runtimeState = this.dependencies.runtimeStateProvider();
    const startupFailureCount = runtimeState?.lastFailure?.code === "LIFECYCLE_START_FAILURE" ? 1 : 0;
    const shutdownFailureCount = runtimeState?.lastFailure?.code === "LIFECYCLE_STOP_FAILURE" ? 1 : 0;

    const yields = workOrders.map((order) =>
      this.dependencies.resultQueries.getWorkOrderYield(order.workOrder.tenantId, order.workOrder.manufacturingWorkOrderId),
    );
    const yieldProjection = yields.length === 0 ? 0 : round(yields.reduce((sum, item) => sum + item.yieldRatio, 0) / yields.length);

    return {
      generatedAt: this.dependencies.runtimeDependencies.clockProvider.now(),
      classification: ManufacturingMetricsService.CLASSIFICATION,
      values: {
        workOrderCount: workOrders.length,
        activeWorkOrderCount: workOrders.filter(
          (entry) =>
            entry.workOrder.workOrderState === "IN_PROGRESS" ||
            entry.workOrder.workOrderState === "READY" ||
            entry.workOrder.workOrderState === "RELEASED",
        ).length,
        completedWorkOrderCount: workOrders.filter((entry) => entry.workOrder.workOrderState === "COMPLETED").length,
        blockedWorkOrderCount: workOrders.filter((entry) => entry.workOrder.workOrderState === "BLOCKED").length,
        routingCount: routings.length,
        operationCount: operations.length,
        activeOperationCount: operations.filter((entry) => entry.execution.operationState === "IN_PROGRESS").length,
        completedOperationCount: operations.filter((entry) => entry.execution.operationState === "COMPLETED").length,
        blockedOperationCount: operations.filter((entry) => entry.execution.operationState === "BLOCKED").length,
        reworkOperationCount: operations.filter((entry) => entry.execution.operationState === "REWORK_REQUIRED").length,
        materialRequirementCount: materialRequirements.length,
        materialIssueRequestCount,
        materialConsumptionRecordCount,
        materialReturnCount,
        materialReconciliationRequiredCount,
        productionOutputCount: outputs.length,
        finishedOutputCount: outputs.filter((entry) => entry.disposition === "FINISHED").length,
        intermediateOutputCount: outputs.filter((entry) => entry.disposition === "INTERMEDIATE").length,
        outputReconciliationRequiredCount,
        scrapRecordCount: scrapByWorkOrder.length,
        scrapQuantity,
        reworkRecordCount: reworkByWorkOrder.length,
        reworkQuantity,
        yieldProjection,
        wipQuantity,
        wipWorkOrderCount: wipStates.length,
        workCenterCount: workCenters.length,
        productionCellCount: productionCells.length,
        machineAssignmentCount: machineAssignments.length,
        toolAssignmentCount: toolAssignments.length,
        laborAssignmentCount: laborAssignments.length,
        resourceConflictCount,
        downtimeRecordCount: downtimeByWorkOrder.length,
        downtimeDuration,
        openExecutionExceptionCount,
        qualityHoldCount,
        traceRecordCount: traceRecords.length,
        traceRejectionCount,
        referenceValidationCount: referenceMetrics.referenceValidationCount,
        referenceValidationFailureCount: referenceMetrics.referenceValidationFailureCount,
        mandatoryReferenceFailureCount: referenceMetrics.mandatoryReferenceFailureCount,
        optionalReferenceFailureCount: referenceMetrics.optionalReferenceFailureCount,
        missingValidatorCount: referenceMetrics.missingValidatorCount,
        tenantMismatchCount: referenceMetrics.tenantMismatchCount,
        staleReferenceCount: referenceMetrics.staleReferenceCount,
        staleVersionCount,
        idempotentReplayCount,
        idempotencyConflictCount,
        productIntegrationFailureCount: referenceMetrics.productIntegrationFailureCount,
        inventoryIntegrationFailureCount: referenceMetrics.inventoryIntegrationFailureCount,
        externalAcceptedLocalCommitFailureCount:
          materialReconciliationRequiredCount + outputReconciliationRequiredCount,
        startupFailureCount,
        shutdownFailureCount,
        observationPublishFailureCount: this.observationPublishFailureCount,
      },
    };
  }
}

export class ManufacturingHealthService {
  constructor(
    private readonly dependencies: {
      runtimeDependencies: ManufacturingRuntimeDependencies;
      runtimeStateProvider: () => ManufacturingRuntimeState | undefined;
      metricsService: ManufacturingMetricsService;
      referenceService: ManufacturingReferenceValidationService;
      workOrders: ManufacturingWorkOrderService;
      routings: ExecutionRoutingService;
      operations: OperationExecutionService;
      materials: MaterialRequirementService;
      materialExecutionQueries: ManufacturingMaterialExecutionQueryService;
      resultQueries: ManufacturingProductionResultQueryService;
      resourceQueries: ManufacturingResourceQueryService;
      traceQueries: ManufacturingTraceabilityQueryService;
      auditService: ManufacturingAuditService;
    },
  ) {}

  private createCheck(
    subsystem: ManufacturingHealthSubsystem,
    status: "PASS" | "WARN" | "FAIL",
    reasonCode: ManufacturingHealthReasonCode,
    detail: string,
    required: boolean,
  ): ManufacturingHealthCheck {
    const category: ManufacturingHealthCategory = status === "FAIL" ? "UNHEALTHY" : status === "WARN" ? "DEGRADED" : "HEALTHY";
    return { subsystem, status, category, reasonCode, detail, required };
  }

  async snapshot(tenantId?: TenantId): Promise<ManufacturingHealthSnapshot> {
    const runtime = this.dependencies.runtimeStateProvider();
    const checks: ManufacturingHealthCheck[] = [];

    checks.push(
      this.createCheck(
        "runtime-readiness",
        runtime?.ready ? "PASS" : runtime?.phase === "FAILED" ? "FAIL" : "WARN",
        runtime?.ready
          ? "HEALTH_CHECK_OK"
          : runtime?.phase === "FAILED"
            ? "RUNTIME_PARTIAL_INITIALIZATION"
            : "RUNTIME_NOT_READY",
        runtime ? `phase=${runtime.phase}` : "runtime state unavailable",
        true,
      ),
    );

    checks.push(
      this.createCheck(
        "provider-registration",
        runtime && runtime.providerIds.length > 0 ? "PASS" : "FAIL",
        runtime && runtime.providerIds.length > 0 ? "HEALTH_CHECK_OK" : "RUNTIME_PARTIAL_INITIALIZATION",
        runtime ? `providers=${runtime.providerIds.length}` : "provider registration unavailable",
        true,
      ),
    );

    checks.push(
      this.createCheck(
        "service-registration",
        runtime && runtime.serviceIds.length > 0 ? "PASS" : "FAIL",
        runtime && runtime.serviceIds.length > 0 ? "HEALTH_CHECK_OK" : "RUNTIME_PARTIAL_INITIALIZATION",
        runtime ? `services=${runtime.serviceIds.length}` : "service registration unavailable",
        true,
      ),
    );

    const referenceHealth = this.dependencies.referenceService.getReferenceHealth();
    const productHealth = this.dependencies.referenceService.getProductIntegrationHealth();
    const inventoryHealth = this.dependencies.referenceService.getInventoryIntegrationHealth();

    checks.push(
      this.createCheck(
        "product-integration",
        productHealth.validatorAvailable ? "PASS" : "FAIL",
        productHealth.validatorAvailable ? "HEALTH_CHECK_OK" : "MISSING_MANDATORY_PRODUCT_VALIDATOR",
        `validatorAvailable=${productHealth.validatorAvailable}; failures=${productHealth.failureCount}`,
        true,
      ),
    );

    checks.push(
      this.createCheck(
        "inventory-integration",
        inventoryHealth.validatorAvailable ? "PASS" : "FAIL",
        inventoryHealth.validatorAvailable ? "HEALTH_CHECK_OK" : "MISSING_MANDATORY_INVENTORY_INTEGRATION",
        `validatorAvailable=${inventoryHealth.validatorAvailable}; failures=${inventoryHealth.failureCount}`,
        true,
      ),
    );

    checks.push(
      this.createCheck(
        "external-validator-availability",
        referenceHealth.status === "UNHEALTHY" ? "FAIL" : referenceHealth.status === "DEGRADED" ? "WARN" : "PASS",
        referenceHealth.status === "UNHEALTHY"
          ? "MISSING_MANDATORY_PRODUCT_VALIDATOR"
          : referenceHealth.status === "DEGRADED"
            ? "OPTIONAL_VALIDATOR_UNAVAILABLE"
            : "HEALTH_CHECK_OK",
        `missingValidators=${referenceHealth.missingValidatorCount}`,
        false,
      ),
    );

    const tenantIds = tenantId ? [tenantId] : this.dependencies.auditService.getKnownTenantIds();
    const workOrders = tenantIds.flatMap((id) => this.dependencies.workOrders.listWorkOrders(id));
    const routings = tenantIds.flatMap((id) => this.dependencies.routings.listExecutionRoutings(id));

    const invalidWorkOrders = workOrders.filter(
      (entry) =>
        entry.workOrder.requestedQuantity.value < 0 ||
        entry.workOrder.plannedQuantity.value < 0 ||
        entry.workOrder.completedQuantity.value < 0,
    ).length;

    checks.push(
      this.createCheck(
        "work-order-invariants",
        invalidWorkOrders === 0 ? "PASS" : "FAIL",
        invalidWorkOrders === 0 ? "HEALTH_CHECK_OK" : "HEALTH_INVARIANT_FAILURE",
        invalidWorkOrders === 0 ? "work order invariants valid" : `invalidWorkOrders=${invalidWorkOrders}`,
        true,
      ),
    );

    let routingIntegrityFailures = 0;
    for (const routing of routings) {
      const stepIds = new Set(routing.routing.steps.map((step) => step.routingStepId));
      const operationIds = new Set<string>();
      for (const step of routing.routing.steps) {
        if (!step.operationExecutionId) {
          routingIntegrityFailures += 1;
          continue;
        }
        const opId = step.operationExecutionId as string;
        if (operationIds.has(opId)) {
          routingIntegrityFailures += 1;
        }
        operationIds.add(opId);
        for (const predecessor of step.predecessorStepIds) {
          if (!stepIds.has(predecessor)) {
            routingIntegrityFailures += 1;
          }
        }
        for (const successor of step.successorStepIds) {
          if (!stepIds.has(successor)) {
            routingIntegrityFailures += 1;
          }
        }
      }
    }

    checks.push(
      this.createCheck(
        "routing-integrity",
        routingIntegrityFailures === 0 ? "PASS" : "FAIL",
        routingIntegrityFailures === 0 ? "HEALTH_CHECK_OK" : "ROUTING_INTEGRITY_FAILURE",
        routingIntegrityFailures === 0 ? "routing integrity valid" : `routingIntegrityFailures=${routingIntegrityFailures}`,
        true,
      ),
    );

    let operationIntegrityFailures = 0;
    for (const workOrder of workOrders) {
      const operations = this.dependencies.operations.listOperationsByWorkOrder(
        workOrder.workOrder.tenantId,
        workOrder.workOrder.manufacturingWorkOrderId,
      );
      for (const operation of operations) {
        if (operation.execution.workOrderId !== workOrder.workOrder.manufacturingWorkOrderId) {
          operationIntegrityFailures += 1;
        }
      }
    }

    checks.push(
      this.createCheck(
        "operation-integrity",
        operationIntegrityFailures === 0 ? "PASS" : "FAIL",
        operationIntegrityFailures === 0 ? "HEALTH_CHECK_OK" : "HEALTH_INVARIANT_FAILURE",
        operationIntegrityFailures === 0 ? "operation integrity valid" : `operationIntegrityFailures=${operationIntegrityFailures}`,
        true,
      ),
    );

    const requirements = tenantIds.flatMap((id) => this.dependencies.materials.listMaterialRequirements(id));
    let requirementIntegrityFailures = 0;
    for (const requirement of requirements) {
      if (!requirement.requiredByOperationId) {
        continue;
      }
      const operation = this.dependencies.operations.getOperationExecution(
        requirement.tenantId,
        requirement.requiredByOperationId as string,
      );
      if (!operation || operation.execution.workOrderId !== requirement.workOrderId) {
        requirementIntegrityFailures += 1;
      }
    }

    checks.push(
      this.createCheck(
        "material-requirement-integrity",
        requirementIntegrityFailures === 0 ? "PASS" : "FAIL",
        requirementIntegrityFailures === 0 ? "HEALTH_CHECK_OK" : "HEALTH_INVARIANT_FAILURE",
        requirementIntegrityFailures === 0
          ? "material requirement integrity valid"
          : `materialRequirementIntegrityFailures=${requirementIntegrityFailures}`,
        true,
      ),
    );

    const metrics = this.dependencies.metricsService.snapshot(tenantId);
    checks.push(
      this.createCheck(
        "inventory-interaction-reconciliation",
        metrics.values.materialReconciliationRequiredCount === 0 ? "PASS" : "WARN",
        metrics.values.materialReconciliationRequiredCount === 0 ? "HEALTH_CHECK_OK" : "RECONCILIATION_REQUIRED",
        `materialReconciliationRequiredCount=${metrics.values.materialReconciliationRequiredCount}`,
        false,
      ),
    );

    checks.push(
      this.createCheck(
        "output-reconciliation",
        metrics.values.outputReconciliationRequiredCount === 0 ? "PASS" : "WARN",
        metrics.values.outputReconciliationRequiredCount === 0 ? "HEALTH_CHECK_OK" : "RECONCILIATION_REQUIRED",
        `outputReconciliationRequiredCount=${metrics.values.outputReconciliationRequiredCount}`,
        false,
      ),
    );

    const wipStates = tenantIds.flatMap((id) => this.dependencies.resultQueries.listWipByWorkOrder(id));
    const invalidWipCount = wipStates.filter(
      (entry) =>
        entry.quantityWaiting.value < 0 ||
        entry.quantityInProcess.value < 0 ||
        entry.quantityCompleted.value < 0,
    ).length;

    checks.push(
      this.createCheck(
        "wip-integrity",
        invalidWipCount === 0 ? "PASS" : "FAIL",
        invalidWipCount === 0 ? "HEALTH_CHECK_OK" : "HEALTH_INVARIANT_FAILURE",
        invalidWipCount === 0 ? "wip integrity valid" : `invalidWipCount=${invalidWipCount}`,
        true,
      ),
    );

    let readinessMismatches = 0;
    for (const order of workOrders) {
      const readiness = this.dependencies.resourceQueries.getResourceReadiness(
        order.workOrder.tenantId,
        order.workOrder.manufacturingWorkOrderId as string,
      );
      if (readiness.resourcesReady !== order.readiness.resourcesReady) {
        readinessMismatches += 1;
      }
    }

    checks.push(
      this.createCheck(
        "resource-readiness-consistency",
        readinessMismatches === 0 ? "PASS" : "FAIL",
        readinessMismatches === 0 ? "HEALTH_CHECK_OK" : "RESOURCE_INTEGRITY_FAILURE",
        readinessMismatches === 0 ? "resource readiness consistency valid" : `resourceReadinessMismatches=${readinessMismatches}`,
        true,
      ),
    );

    const downtimeRecords = workOrders.flatMap((order) =>
      this.dependencies.resourceQueries.listDowntimeByWorkOrder(
        order.workOrder.tenantId,
        order.workOrder.manufacturingWorkOrderId,
      ),
    );
    const invalidDowntime = downtimeRecords.filter(
      (entry) => (entry.status === "CLOSED" && (!entry.endedAt || typeof entry.duration !== "number" || entry.duration < 0)),
    ).length;

    checks.push(
      this.createCheck(
        "downtime-integrity",
        invalidDowntime === 0 ? "PASS" : "FAIL",
        invalidDowntime === 0 ? "HEALTH_CHECK_OK" : "HEALTH_INVARIANT_FAILURE",
        invalidDowntime === 0 ? "downtime integrity valid" : `invalidDowntimeRecords=${invalidDowntime}`,
        true,
      ),
    );

    let traceIntegrityFailures = 0;
    for (const tenant of tenantIds) {
      const traces = this.dependencies.traceQueries.listProductionTrace(tenant);
      let previousSequence = 0;
      const sequenceSet = new Set<number>();
      for (const trace of traces) {
        if (trace.appendSequence <= previousSequence || sequenceSet.has(trace.appendSequence)) {
          traceIntegrityFailures += 1;
        }
        previousSequence = trace.appendSequence;
        sequenceSet.add(trace.appendSequence);
      }
    }

    checks.push(
      this.createCheck(
        "traceability-integrity",
        traceIntegrityFailures === 0 ? "PASS" : "WARN",
        traceIntegrityFailures === 0 ? "HEALTH_CHECK_OK" : "TRACEABILITY_VIOLATION",
        traceIntegrityFailures === 0 ? "traceability integrity valid" : `traceIntegrityFailures=${traceIntegrityFailures}`,
        false,
      ),
    );

    checks.push(
      this.createCheck(
        "idempotency-integrity",
        metrics.values.idempotencyConflictCount === 0 ? "PASS" : "WARN",
        metrics.values.idempotencyConflictCount === 0 ? "HEALTH_CHECK_OK" : "INFORMATIONAL",
        `idempotencyConflictCount=${metrics.values.idempotencyConflictCount}`,
        true,
      ),
    );

    checks.push(
      this.createCheck(
        "concurrency-conflict-pressure",
        metrics.values.staleVersionCount >= 3 ? "FAIL" : metrics.values.staleVersionCount > 0 ? "WARN" : "PASS",
        metrics.values.staleVersionCount >= 3
          ? "HEALTH_INVARIANT_FAILURE"
          : metrics.values.staleVersionCount > 0
            ? "INFORMATIONAL"
            : "HEALTH_CHECK_OK",
        `staleVersionCount=${metrics.values.staleVersionCount}`,
        true,
      ),
    );

    const auditSinkHealth = await this.dependencies.runtimeDependencies.auditSinkProvider.inspectHealth();
    const observationSinkHealth = await this.dependencies.runtimeDependencies.observationSinkProvider.inspectHealth();

    checks.push(
      this.createCheck(
        "audit-sink",
        auditSinkHealth.status === "HEALTHY" ? "PASS" : "FAIL",
        auditSinkHealth.status === "HEALTHY" ? "HEALTH_CHECK_OK" : "AUDIT_SINK_UNAVAILABLE",
        auditSinkHealth.detail,
        true,
      ),
    );

    checks.push(
      this.createCheck(
        "observation-sink",
        observationSinkHealth.status === "HEALTHY" ? "PASS" : "WARN",
        observationSinkHealth.status === "HEALTHY" ? "HEALTH_CHECK_OK" : "OBSERVATION_SINK_UNAVAILABLE",
        observationSinkHealth.detail,
        false,
      ),
    );

    checks.push(
      this.createCheck(
        "persistence-recovery",
        "WARN",
        "PERSISTENCE_NOT_IMPLEMENTED",
        "persistence and recovery are intentionally not implemented in this slice",
        false,
      ),
    );

    const ordered = [...checks].sort((left, right) => compareDeterministicStrings(left.subsystem, right.subsystem));
    const hasFail = ordered.some((check) => check.status === "FAIL");
    const hasWarn = ordered.some((check) => check.status === "WARN");
    const status: ManufacturingHealthCategory = hasFail ? "UNHEALTHY" : hasWarn ? "DEGRADED" : "HEALTHY";

    return {
      status,
      generatedAt: this.dependencies.runtimeDependencies.clockProvider.now(),
      checks: ordered,
    };
  }
}

export class ManufacturingObservationPublisher {
  private readonly observers = new ObserverRegistry<ManufacturingMissionControlObservation>();
  private readonly publisher = new ObservationPublisher(this.observers);

  constructor(
    private readonly dependencies: {
      runtimeDependencies: ManufacturingRuntimeDependencies;
      runtimeStateProvider: () => ManufacturingRuntimeState | undefined;
      metricsService: ManufacturingMetricsService;
      healthService: ManufacturingHealthService;
      referenceService: ManufacturingReferenceValidationService;
      auditService: ManufacturingAuditService;
    },
  ) {}

  registerObserver(
    observerId: string,
    receiveObservation: (observation: ManufacturingMissionControlObservation) => Promise<void>,
  ): void {
    this.observers.register({ observerId, receiveObservation });
  }

  getRuntimeReadiness(): ManufacturingRuntimeReadinessProjection {
    return createRuntimeReadinessProjection(this.dependencies.runtimeStateProvider());
  }

  async buildManufacturingObservation(tenantId?: TenantId): Promise<ManufacturingMissionControlObservation> {
    const runtime = this.getRuntimeReadiness();
    const health = await this.dependencies.healthService.snapshot(tenantId);
    const metrics = this.dependencies.metricsService.snapshot(tenantId);
    const reasonCodes = [...new Set(health.checks.filter((check) => check.status !== "PASS").map((check) => check.reasonCode))]
      .sort(compareDeterministicStrings);

    return {
      platformIdentifier: "platform.manufacturing",
      schemaVersion: "1.0.0",
      runtimeState: runtime,
      readiness: runtime.ready,
      overallHealth: health.status,
      subsystemHealth: health.checks,
      metricsSnapshot: metrics,
      workOrderSummary: {
        total: metrics.values.workOrderCount,
        active: metrics.values.activeWorkOrderCount,
        completed: metrics.values.completedWorkOrderCount,
        blocked: metrics.values.blockedWorkOrderCount,
      },
      operationSummary: {
        total: metrics.values.operationCount,
        active: metrics.values.activeOperationCount,
        completed: metrics.values.completedOperationCount,
        blocked: metrics.values.blockedOperationCount,
        rework: metrics.values.reworkOperationCount,
      },
      wipSummary: {
        quantity: metrics.values.wipQuantity,
        workOrderCount: metrics.values.wipWorkOrderCount,
      },
      downtimeSummary: {
        recordCount: metrics.values.downtimeRecordCount,
        durationMinutes: metrics.values.downtimeDuration,
      },
      yieldProjection: metrics.values.yieldProjection,
      reconciliationSummary: {
        materialReconciliationRequiredCount: metrics.values.materialReconciliationRequiredCount,
        outputReconciliationRequiredCount: metrics.values.outputReconciliationRequiredCount,
      },
      referenceHealthSummary: this.dependencies.referenceService.getReferenceHealth(),
      timestamp: this.dependencies.runtimeDependencies.clockProvider.now(),
      contractVersion: "1.0.0",
      reasonCodes,
    };
  }

  async publishManufacturingObservation(tenantId?: TenantId): Promise<ManufacturingMissionControlObservation> {
    const observation = await this.buildManufacturingObservation(tenantId);
    try {
      await this.publisher.publish(observation);
      await this.dependencies.auditService.getAuditSinkProvider().recordAudit({
        eventType: "manufacturing.observation.published",
        message: "manufacturing observation published",
        recordedAt: this.dependencies.runtimeDependencies.clockProvider.now(),
        details: {
          action: "PUBLISH_MANUFACTURING_OBSERVATION",
          success: true,
        },
      });
    } catch (error) {
      this.dependencies.metricsService.recordObservationPublishFailure();
      await this.dependencies.auditService.getAuditSinkProvider().recordAudit({
        eventType: "manufacturing.observation.publish.rejected",
        message: "manufacturing observation publication failed",
        recordedAt: this.dependencies.runtimeDependencies.clockProvider.now(),
        details: {
          action: "PUBLISH_MANUFACTURING_OBSERVATION",
          success: false,
          resultClassification: "OBSERVATION_PUBLICATION_FAILURE",
          reason: error instanceof Error ? error.message : "unknown error",
        },
      });
      throw new ManufacturingDomainError(
        "OBSERVATION_PUBLICATION_FAILURE",
        error instanceof Error ? error.message : "observation publication failed",
        true,
      );
    }

    return structuredClone(observation);
  }
}

export type ManufacturingAuditProjection = Readonly<{
  status: ManufacturingHealthCategory;
  summary: ReturnType<ManufacturingAuditService["summarize"]>;
}>;

export type ManufacturingObservabilityDependencies = Readonly<{
  auditService: ManufacturingAuditService;
  metricsService: ManufacturingMetricsService;
  healthService: ManufacturingHealthService;
  observationPublisher: ManufacturingObservationPublisher;
  referenceValidationService: ManufacturingReferenceValidationService;
  runtimeStateProvider: () => ManufacturingRuntimeState | undefined;
}>;
