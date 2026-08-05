import type { KnowledgeHealth } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class KnowledgeHealthService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  async snapshot(): Promise<KnowledgeHealth> {
    const state = this.persistence.snapshot();
    const metrics = state.metrics;
    const degraded = metrics.corruptStateCount > 0;

    return {
      status: degraded ? "DEGRADED" : "HEALTHY",
      generatedAt: nowIso(),
      checks: [
        { name: "persistence", status: "PASS", detail: `schema=${state.schemaVersion}` },
        { name: "registry", status: "PASS", detail: `knowledge=${metrics.knowledgeTotal}` },
        { name: "lifecycle", status: "PASS", detail: `active=${metrics.activeKnowledge},archived=${metrics.archivedKnowledge}` },
        { name: "governance", status: "PASS", detail: `attested=${metrics.attestedKnowledge}` },
        { name: "audit", status: degraded ? "WARN" : "PASS", detail: `corruptStateCount=${metrics.corruptStateCount}` },
      ],
    };
  }
}
