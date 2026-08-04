import type { Organization, OrganizationMetricsSnapshot } from "../contracts";
import { createDefaultOrganizationMetrics } from "../contracts";

export class OrganizationMetricsService {
  constructor(private readonly snapshotState: OrganizationMetricsSnapshot = createDefaultOrganizationMetrics()) {}

  snapshot(): OrganizationMetricsSnapshot {
    return structuredClone(this.snapshotState);
  }

  increment(field: keyof OrganizationMetricsSnapshot, amount = 1): void {
    const current = this.snapshotState[field];
    if (typeof current === "number") {
      (this.snapshotState[field] as number) = current + amount;
    }
  }

  recalculateOrganizations(organizations: Organization[]): void {
    this.snapshotState.organizationCount = organizations.length;
    this.snapshotState.activeOrganizationCount = organizations.filter((item) => item.status === "ACTIVE").length;
    this.snapshotState.suspendedOrganizationCount = organizations.filter((item) => item.status === "SUSPENDED").length;
    this.snapshotState.archivedOrganizationCount = organizations.filter((item) => item.status === "ARCHIVED").length;
  }

  setHierarchyNodeCount(count: number): void {
    this.snapshotState.hierarchyNodeCount = count;
  }

  setRelationshipCount(count: number): void {
    this.snapshotState.relationshipCount = count;
  }

  replace(snapshot: OrganizationMetricsSnapshot): void {
    Object.assign(this.snapshotState, structuredClone(snapshot));
  }
}
