import type { AssetHealth } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class AssetHealthService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async snapshot(): Promise<AssetHealth> {
    const state = this.persistence.snapshot();
    const metrics = state.metrics;
    const degraded = metrics.integrityFailures > 0 || metrics.corruptStateCount > 0;

    return {
      status: degraded ? "DEGRADED" : "HEALTHY",
      generatedAt: nowIso(),
      checks: [
        { name: "persistence", status: "PASS", detail: `schema=${state.schemaVersion}` },
        { name: "registry", status: "PASS", detail: `assets=${metrics.assetsTotal}` },
        { name: "versions", status: "PASS", detail: `versions=${metrics.versionsTotal}` },
        { name: "integrity", status: degraded ? "WARN" : "PASS", detail: `failures=${metrics.integrityFailures}` },
        { name: "relationships", status: "PASS", detail: `relationships=${metrics.relationshipsTotal}` },
        { name: "collections", status: "PASS", detail: `collections=${metrics.collectionsTotal}` },
        { name: "lifecycle", status: "PASS", detail: `archived=${metrics.archivedAssets},softDeleted=${metrics.softDeletedAssets}` },
        { name: "retention", status: "PASS", detail: `protected=${metrics.retentionProtectedAssets}` },
      ],
    };
  }
}
