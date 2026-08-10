import { compareDeterministicStrings } from "../../shared";
import type {
  ManufacturingFailureClassification,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingRuntimeAuditRecord,
} from "../integration";

export type ManufacturingAuditCategory =
  | "RUNTIME"
  | "WORK_ORDER"
  | "PRODUCTION_RUN"
  | "PRODUCTION_BATCH"
  | "ROUTING"
  | "OPERATION"
  | "PRODUCT_REFERENCE"
  | "MATERIAL_REQUIREMENT"
  | "INVENTORY_INTERACTION"
  | "MATERIAL_ISSUE"
  | "MATERIAL_CONSUMPTION"
  | "PRODUCTION_OUTPUT"
  | "SCRAP"
  | "REWORK"
  | "WIP"
  | "WORK_CENTER"
  | "PRODUCTION_CELL"
  | "MACHINE_ASSIGNMENT"
  | "TOOL_ASSIGNMENT"
  | "LABOR_ASSIGNMENT"
  | "DOWNTIME"
  | "EXECUTION_EXCEPTION"
  | "QUALITY_HOLD"
  | "TRACEABILITY"
  | "REFERENCE"
  | "OBSERVATION";

export type ManufacturingAuditEvent = Readonly<{
  auditEventId: string;
  category: ManufacturingAuditCategory;
  action: string;
  rejectionClassification?: string;
  tenantId?: TenantId;
  correlationId?: string;
  workOrderId?: string;
  entityType?: string;
  entityId?: string;
  record: ManufacturingRuntimeAuditRecord;
}>;

export type ManufacturingAuditSummary = Readonly<{
  totalEvents: number;
  acceptedEvents: number;
  rejectedEvents: number;
  byCategory: Readonly<Record<ManufacturingAuditCategory, number>>;
}>;

function cloneRecord(record: ManufacturingRuntimeAuditRecord): ManufacturingRuntimeAuditRecord {
  return structuredClone(record);
}

function readStringDetail(record: ManufacturingRuntimeAuditRecord, key: string): string | undefined {
  const value = record.details?.[key];
  return typeof value === "string" ? value : undefined;
}

function readBooleanDetail(record: ManufacturingRuntimeAuditRecord, key: string): boolean | undefined {
  const value = record.details?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function categoryFromEventType(eventType: string): ManufacturingAuditCategory {
  const normalized = eventType.toLowerCase();
  if (normalized.includes("work-order")) return "WORK_ORDER";
  if (normalized.includes("production-run")) return "PRODUCTION_RUN";
  if (normalized.includes("production-batch")) return "PRODUCTION_BATCH";
  if (normalized.includes("execution-routing") || normalized.includes("routing")) return "ROUTING";
  if (normalized.includes("operation")) return "OPERATION";
  if (normalized.includes("product-baseline") || normalized.includes("product-reference")) return "PRODUCT_REFERENCE";
  if (normalized.includes("material-requirement")) return "MATERIAL_REQUIREMENT";
  if (normalized.includes("material-issue")) return "MATERIAL_ISSUE";
  if (normalized.includes("material-consumption")) return "MATERIAL_CONSUMPTION";
  if (normalized.includes("inventory")) return "INVENTORY_INTERACTION";
  if (normalized.includes("production-output")) return "PRODUCTION_OUTPUT";
  if (normalized.includes("scrap")) return "SCRAP";
  if (normalized.includes("rework")) return "REWORK";
  if (normalized.includes("wip")) return "WIP";
  if (normalized.includes("work-center")) return "WORK_CENTER";
  if (normalized.includes("production-cell")) return "PRODUCTION_CELL";
  if (normalized.includes("machine-assignment")) return "MACHINE_ASSIGNMENT";
  if (normalized.includes("tool-assignment")) return "TOOL_ASSIGNMENT";
  if (normalized.includes("labor-assignment")) return "LABOR_ASSIGNMENT";
  if (normalized.includes("downtime")) return "DOWNTIME";
  if (normalized.includes("execution-exception")) return "EXECUTION_EXCEPTION";
  if (normalized.includes("quality-hold") || normalized.includes("quality_hold")) return "QUALITY_HOLD";
  if (normalized.includes("traceability") || normalized.includes("trace")) return "TRACEABILITY";
  if (normalized.includes("reference")) return "REFERENCE";
  if (normalized.includes("observation")) return "OBSERVATION";
  return "RUNTIME";
}

function createCategoryCounts(): Record<ManufacturingAuditCategory, number> {
  return {
    RUNTIME: 0,
    WORK_ORDER: 0,
    PRODUCTION_RUN: 0,
    PRODUCTION_BATCH: 0,
    ROUTING: 0,
    OPERATION: 0,
    PRODUCT_REFERENCE: 0,
    MATERIAL_REQUIREMENT: 0,
    INVENTORY_INTERACTION: 0,
    MATERIAL_ISSUE: 0,
    MATERIAL_CONSUMPTION: 0,
    PRODUCTION_OUTPUT: 0,
    SCRAP: 0,
    REWORK: 0,
    WIP: 0,
    WORK_CENTER: 0,
    PRODUCTION_CELL: 0,
    MACHINE_ASSIGNMENT: 0,
    TOOL_ASSIGNMENT: 0,
    LABOR_ASSIGNMENT: 0,
    DOWNTIME: 0,
    EXECUTION_EXCEPTION: 0,
    QUALITY_HOLD: 0,
    TRACEABILITY: 0,
    REFERENCE: 0,
    OBSERVATION: 0,
  };
}

export class ManufacturingAuditService {
  private readonly events = new Map<string, ManufacturingAuditEvent>();
  private readonly tenantIds = new Set<TenantId>();
  private sequence = 0;

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      upstreamAuditSink: ManufacturingAuditSinkProvider;
    },
  ) {}

  private createAuditEvent(record: ManufacturingRuntimeAuditRecord): ManufacturingAuditEvent {
    this.sequence += 1;
    const auditEventId = `${record.recordedAt}:${this.sequence.toString().padStart(9, "0")}`;
    const tenantId = readStringDetail(record, "tenantId") as TenantId | undefined;
    if (tenantId) {
      this.tenantIds.add(tenantId);
    }

    return {
      auditEventId,
      category: categoryFromEventType(record.eventType),
      action: readStringDetail(record, "action") ?? "UNKNOWN_ACTION",
      rejectionClassification:
        readStringDetail(record, "resultClassification") ??
        readStringDetail(record, "rejectionClassification") ??
        readStringDetail(record, "classification"),
      tenantId,
      correlationId: readStringDetail(record, "correlationId"),
      workOrderId: readStringDetail(record, "workOrderId"),
      entityType: readStringDetail(record, "entityType"),
      entityId: readStringDetail(record, "entityId"),
      record: cloneRecord(record),
    };
  }

  getAuditSinkProvider(): ManufacturingAuditSinkProvider {
    return {
      ...this.dependencies.upstreamAuditSink,
      providerId: `${this.dependencies.upstreamAuditSink.providerId}.manufacturing-audit-service`,
      recordAudit: async (record: ManufacturingRuntimeAuditRecord) => {
        const event = this.createAuditEvent(record);
        this.events.set(event.auditEventId, event);
        await this.dependencies.upstreamAuditSink.recordAudit(record);
      },
    };
  }

  getKnownTenantIds(): TenantId[] {
    return [...this.tenantIds].sort(compareDeterministicStrings);
  }

  getManufacturingAuditEvent(auditEventId: string): ManufacturingAuditEvent | undefined {
    const found = this.events.get(auditEventId);
    return found ? structuredClone(found) : undefined;
  }

  listManufacturingAuditEvents(tenantId?: TenantId): ManufacturingAuditEvent[] {
    return [...this.events.values()]
      .filter((event) => !tenantId || event.tenantId === tenantId)
      .sort((left, right) => {
        const byTime = compareDeterministicStrings(left.record.recordedAt, right.record.recordedAt);
        return byTime !== 0 ? byTime : compareDeterministicStrings(left.auditEventId, right.auditEventId);
      })
      .map((event) => structuredClone(event));
  }

  listAuditEventsByWorkOrder(workOrderId: string, tenantId?: TenantId): ManufacturingAuditEvent[] {
    return this.listManufacturingAuditEvents(tenantId).filter((event) => event.workOrderId === workOrderId);
  }

  listAuditEventsByEntity(entityType: string, entityId?: string, tenantId?: TenantId): ManufacturingAuditEvent[] {
    return this.listManufacturingAuditEvents(tenantId).filter(
      (event) => event.entityType === entityType && (!entityId || event.entityId === entityId),
    );
  }

  listAuditEventsByAction(action: string, tenantId?: TenantId): ManufacturingAuditEvent[] {
    return this.listManufacturingAuditEvents(tenantId).filter((event) => event.action === action);
  }

  listAuditEventsByCorrelation(correlationId: string, tenantId?: TenantId): ManufacturingAuditEvent[] {
    return this.listManufacturingAuditEvents(tenantId).filter((event) => event.correlationId === correlationId);
  }

  summarize(tenantId?: TenantId): ManufacturingAuditSummary {
    const events = this.listManufacturingAuditEvents(tenantId);
    const byCategory = createCategoryCounts();
    let acceptedEvents = 0;
    let rejectedEvents = 0;

    for (const event of events) {
      byCategory[event.category] += 1;
      const explicitSuccess = readBooleanDetail(event.record, "success");
      if (explicitSuccess === true) {
        acceptedEvents += 1;
      } else if (explicitSuccess === false || event.record.eventType.includes("rejected")) {
        rejectedEvents += 1;
      }
    }

    return {
      totalEvents: events.length,
      acceptedEvents,
      rejectedEvents,
      byCategory,
    };
  }

  rejectMutation(): never {
    throw new ManufacturingDomainError(
      "HEALTH_INVARIANT_FAILURE",
      "manufacturing audit mutation is prohibited",
      false,
    );
  }

  rejectDeletion(): never {
    throw new ManufacturingDomainError(
      "HEALTH_INVARIANT_FAILURE",
      "manufacturing audit deletion is prohibited",
      false,
    );
  }

  async recordSlice9AuditFailure(
    classification: ManufacturingFailureClassification,
    message: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.getAuditSinkProvider().recordAudit({
      eventType: "manufacturing.audit.failure",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        action: "AUDIT_FAILURE",
        success: false,
        resultClassification: classification,
        ...(details ?? {}),
      },
    });
  }
}
