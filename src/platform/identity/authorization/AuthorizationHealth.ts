import type { DecisionCacheStats } from "./DecisionCache";
import type { AuthorizationMetrics } from "./AuthorizationMetrics";

export type AuthorizationHealthSnapshot = {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  checks: Array<{
    name: string;
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
  generatedAt: string;
};

export class AuthorizationHealth {
  snapshot(input: {
    policyCount: number;
    cacheStats: DecisionCacheStats;
    metrics: AuthorizationMetrics;
  }): AuthorizationHealthSnapshot {
    const metricSnapshot = input.metrics.snapshot();
    const status = input.policyCount > 0 ? "HEALTHY" : "CRITICAL";

    return {
      status,
      checks: [
        {
          name: "policy",
          status: input.policyCount > 0 ? "PASS" : "FAIL",
          detail: `count=${input.policyCount}`,
        },
        {
          name: "cache",
          status: "PASS",
          detail: `size=${input.cacheStats.size}; hits=${input.cacheStats.hitCount}; misses=${input.cacheStats.missCount}`,
        },
        {
          name: "metrics",
          status: "PASS",
          detail: `evaluated=${metricSnapshot.evaluatedCount}; denied=${metricSnapshot.deniedCount}`,
        },
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}
