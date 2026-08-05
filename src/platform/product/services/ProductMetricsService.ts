import type { ProductMetrics } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

export class ProductMetricsService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  snapshot(): ProductMetrics {
    return this.persistence.snapshot().metrics;
  }
}
