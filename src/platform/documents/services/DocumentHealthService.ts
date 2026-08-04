import type { DocumentHealth } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class DocumentHealthService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async snapshot(): Promise<DocumentHealth> {
    const state = this.persistence.snapshot();
    const metrics = state.metrics;
    const degraded = metrics.corruptStateCount > 0;

    return {
      status: degraded ? "DEGRADED" : "HEALTHY",
      generatedAt: nowIso(),
      checks: [
        { name: "persistence", status: "PASS", detail: `schema=${state.schemaVersion}` },
        { name: "registry", status: "PASS", detail: `documents=${metrics.documentsTotal}` },
        { name: "templates", status: "PASS", detail: `templates=${metrics.templatesTotal}` },
        { name: "revisions", status: "PASS", detail: `revisions=${metrics.revisionsTotal}` },
        { name: "approvals", status: "PASS", detail: `approvals=${metrics.approvalsTotal}` },
        { name: "signatures", status: "PASS", detail: `signatures=${metrics.signaturesTotal}` },
        { name: "lifecycle", status: "PASS", detail: `active=${metrics.activeDocuments},archived=${metrics.archivedDocuments}` },
        { name: "relationships", status: "PASS", detail: `relationships=${metrics.relationshipsTotal}` },
        { name: "assetReferences", status: "PASS", detail: `assetReferences=${metrics.assetReferencesTotal}` },
      ],
    };
  }
}
