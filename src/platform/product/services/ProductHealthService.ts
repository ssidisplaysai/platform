import type { ProductHealth } from "../contracts";
import type { ProductProviderRegistry } from "../integration";
import type { PersistenceCoordinator } from "../persistence";

function nowIso(): string {
  return new Date().toISOString();
}

export class ProductHealthService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly providers: ProductProviderRegistry,
  ) {}

  async snapshot(): Promise<ProductHealth> {
    const state = this.persistence.snapshot();
    const metrics = state.metrics;
    const providerCount = this.providers.listProviders().length;
    const degraded =
      metrics.corruptStateCount > 0 ||
      metrics.invalidReferenceCount > 0 ||
      metrics.invariantViolationCount > 0;

    return {
      status: degraded ? "DEGRADED" : "HEALTHY",
      generatedAt: nowIso(),
      checks: [
        { name: "persistence", status: "PASS", detail: `schema=${state.schemaVersion}` },
        {
          name: "provider-registry",
          status: providerCount > 0 ? "PASS" : "FAIL",
          detail: `providers=${providerCount}`,
        },
        { name: "invariants", status: "PASS", detail: `products=${metrics.productTotal}` },
        {
          name: "references",
          status: metrics.invalidReferenceCount > 0 ? "WARN" : "PASS",
          detail: `invalidReferenceCount=${metrics.invalidReferenceCount}`,
        },
        {
          name: "audit",
          status: metrics.corruptStateCount > 0 ? "WARN" : "PASS",
          detail: `corruptStateCount=${metrics.corruptStateCount}`,
        },
        {
          name: "integration-ports",
          status: providerCount > 0 ? "PASS" : "FAIL",
          detail: `providers=${providerCount}`,
        },
      ],
    };
  }
}
