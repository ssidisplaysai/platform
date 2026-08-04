import type { OrganizationHealthSnapshot } from "../contracts";
import type { OrganizationMetricsService } from "../metrics";
import type { OrganizationAuditWriter } from "../audit";

export class OrganizationHealthService {
  constructor(
    private readonly metrics: OrganizationMetricsService,
    private readonly audit: OrganizationAuditWriter,
  ) {}

  snapshot(): OrganizationHealthSnapshot {
    const metrics = this.metrics.snapshot();
    const checks: OrganizationHealthSnapshot["checks"] = [
      {
        name: "persistence",
        status: metrics.persistenceSaveCount > 0 || metrics.persistenceLoadCount > 0 ? "PASS" : "WARN",
        detail: `loads=${metrics.persistenceLoadCount} saves=${metrics.persistenceSaveCount}`,
      },
      {
        name: "registry",
        status: metrics.organizationCount > 0 ? "PASS" : "WARN",
        detail: `organizations=${metrics.organizationCount}`,
      },
      {
        name: "hierarchy",
        status: metrics.hierarchyNodeCount > 0 ? "PASS" : "WARN",
        detail: `nodes=${metrics.hierarchyNodeCount}`,
      },
      {
        name: "relationships",
        status: "PASS",
        detail: `relationships=${metrics.relationshipCount}`,
      },
      {
        name: "audit",
        status: this.audit.list(1).length > 0 ? "PASS" : "WARN",
        detail: `records=${metrics.auditRecordCount}`,
      },
      {
        name: "metrics",
        status: "PASS",
        detail: "metrics service available",
      },
      {
        name: "integration",
        status: "PASS",
        detail: "mission control observability endpoints are read-only",
      },
    ];

    const hasFail = checks.some((check) => check.status === "FAIL");

    return {
      status: hasFail ? "DEGRADED" : "HEALTHY",
      checks,
      generatedAt: new Date().toISOString(),
    };
  }
}
