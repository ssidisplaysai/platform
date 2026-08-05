import type { KnowledgeMetrics } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

export class KnowledgeMetricsService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  snapshot(): KnowledgeMetrics {
    return this.persistence.snapshot().metrics;
  }
}
