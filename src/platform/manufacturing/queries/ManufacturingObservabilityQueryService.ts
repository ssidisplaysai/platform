import type { TenantId } from "../contracts";
import type { ManufacturingAuditService } from "../services/ManufacturingAuditService";
import type {
  ManufacturingHealthService,
  ManufacturingHealthSnapshot,
  ManufacturingMetricsService,
  ManufacturingMetricsSnapshot,
  ManufacturingMissionControlObservation,
  ManufacturingObservationPublisher,
  ManufacturingRuntimeReadinessProjection,
} from "../services/ManufacturingObservabilityService";
import type {
  ManufacturingIntegrationReferenceHealth,
  ManufacturingReferenceHealth,
  ManufacturingReferenceValidationService,
} from "../services/ManufacturingReferenceValidationService";

export type ManufacturingReferenceHealthProjection = Readonly<{
  status: ManufacturingReferenceHealth["status"];
  summary: ManufacturingReferenceHealth;
  productIntegration: ManufacturingIntegrationReferenceHealth;
  inventoryIntegration: ManufacturingIntegrationReferenceHealth;
}>;

export class ManufacturingObservabilityQueryService {
  constructor(
    private readonly dependencies: {
      healthService: ManufacturingHealthService;
      metricsService: ManufacturingMetricsService;
      auditService: ManufacturingAuditService;
      referenceService: ManufacturingReferenceValidationService;
      observationPublisher: ManufacturingObservationPublisher;
    },
  ) {}

  async getManufacturingHealth(tenantId?: TenantId): Promise<ManufacturingHealthSnapshot> {
    return this.dependencies.healthService.snapshot(tenantId);
  }

  getManufacturingMetrics(tenantId?: TenantId): ManufacturingMetricsSnapshot {
    return this.dependencies.metricsService.snapshot(tenantId);
  }

  getManufacturingAuditEvent(auditEventId: string) {
    return this.dependencies.auditService.getManufacturingAuditEvent(auditEventId);
  }

  listManufacturingAuditEvents(tenantId?: TenantId) {
    return this.dependencies.auditService.listManufacturingAuditEvents(tenantId);
  }

  listAuditEventsByWorkOrder(workOrderId: string, tenantId?: TenantId) {
    return this.dependencies.auditService.listAuditEventsByWorkOrder(workOrderId, tenantId);
  }

  listAuditEventsByEntity(entityType: string, entityId?: string, tenantId?: TenantId) {
    return this.dependencies.auditService.listAuditEventsByEntity(entityType, entityId, tenantId);
  }

  listAuditEventsByAction(action: string, tenantId?: TenantId) {
    return this.dependencies.auditService.listAuditEventsByAction(action, tenantId);
  }

  listAuditEventsByCorrelation(correlationId: string, tenantId?: TenantId) {
    return this.dependencies.auditService.listAuditEventsByCorrelation(correlationId, tenantId);
  }

  getManufacturingReferenceHealth(): ManufacturingReferenceHealthProjection {
    const summary = this.dependencies.referenceService.getReferenceHealth();
    return {
      status: summary.status,
      summary,
      productIntegration: this.dependencies.referenceService.getProductIntegrationHealth(),
      inventoryIntegration: this.dependencies.referenceService.getInventoryIntegrationHealth(),
    };
  }

  getProductIntegrationHealth(): ManufacturingIntegrationReferenceHealth {
    return this.dependencies.referenceService.getProductIntegrationHealth();
  }

  getInventoryIntegrationHealth(): ManufacturingIntegrationReferenceHealth {
    return this.dependencies.referenceService.getInventoryIntegrationHealth();
  }

  getManufacturingRuntimeReadiness(): ManufacturingRuntimeReadinessProjection {
    return this.dependencies.observationPublisher.getRuntimeReadiness();
  }

  async buildManufacturingObservation(tenantId?: TenantId): Promise<ManufacturingMissionControlObservation> {
    return this.dependencies.observationPublisher.buildManufacturingObservation(tenantId);
  }
}
