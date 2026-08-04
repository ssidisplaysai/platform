import type { AssetMetrics } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

export class AssetMetricsService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  snapshot(): AssetMetrics {
    return this.persistence.snapshot().metrics;
  }
}
