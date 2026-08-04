import type { OrganizationIntegrationSnapshot, OrganizationPlatformDependencies } from "../contracts";
import type { OrganizationHealthService } from "../health";
import type { OrganizationMetricsService } from "../metrics";

export class MissionControlOrganizationIntegrationService {
  constructor(
    private readonly health: OrganizationHealthService,
    private readonly metrics: OrganizationMetricsService,
    private readonly dependencies: OrganizationPlatformDependencies,
  ) {}

  snapshot(): OrganizationIntegrationSnapshot {
    return {
      capabilityId: "platform.organization",
      capabilityName: "Genesis Organization Platform",
      version: "1.0.0",
      health: this.health.snapshot(),
      metrics: this.metrics.snapshot(),
      consumedBoundaries: {
        identity: Boolean(this.dependencies.identity),
        authorization: Boolean(this.dependencies.authorization),
        messaging: Boolean(this.dependencies.messaging),
        workflow: Boolean(this.dependencies.workflow),
        scheduling: Boolean(this.dependencies.scheduling),
        notifications: Boolean(this.dependencies.notifications),
        ai: Boolean(this.dependencies.ai),
      },
      readiness: {
        providerNeutral: true,
        applicationNeutral: true,
        workflowNeutral: true,
        schedulingNeutral: true,
        messagingNeutral: true,
        notificationNeutral: true,
        missionControlCompatible: true,
      },
    };
  }

  missionControlHealth() {
    return this.health.snapshot();
  }

  missionControlMetrics() {
    return this.metrics.snapshot();
  }

  gopAggregateMetrics() {
    const metrics = this.metrics.snapshot();
    return {
      capabilityId: "platform.organization",
      organizationCount: metrics.organizationCount,
      activeOrganizationCount: metrics.activeOrganizationCount,
      hierarchyNodeCount: metrics.hierarchyNodeCount,
      relationshipCount: metrics.relationshipCount,
      lifecycleTransitionCount: metrics.lifecycleTransitionCount,
      settingsUpdateCount: metrics.settingsUpdateCount,
      metadataUpdateCount: metrics.metadataUpdateCount,
      auditRecordCount: metrics.auditRecordCount,
    };
  }
}
