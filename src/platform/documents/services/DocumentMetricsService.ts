import type { DocumentMetrics } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

export class DocumentMetricsService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  snapshot(): DocumentMetrics {
    return this.persistence.snapshot().metrics;
  }
}
