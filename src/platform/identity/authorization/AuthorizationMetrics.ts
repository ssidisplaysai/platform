import type { AuthorizationDecision } from "./AuthorizationDecision";

type AuthorizationMetricsSnapshot = {
  evaluatedCount: number;
  allowedCount: number;
  deniedCount: number;
  cacheHitCount: number;
  cacheMissCount: number;
  avgLatencyMs: number;
  reasonCodeCounts: Record<string, number>;
  resolverStats: {
    roleResolutions: number;
    permissionResolutions: number;
    capabilityResolutions: number;
    workspaceResolutions: number;
    resourceAuthorizations: number;
  };
};

export class AuthorizationMetrics {
  private evaluatedCount = 0;
  private allowedCount = 0;
  private deniedCount = 0;
  private cacheHitCount = 0;
  private cacheMissCount = 0;
  private totalLatencyMs = 0;
  private readonly reasonCodeCounts: Record<string, number> = {};
  private readonly resolverStats = {
    roleResolutions: 0,
    permissionResolutions: 0,
    capabilityResolutions: 0,
    workspaceResolutions: 0,
    resourceAuthorizations: 0,
  };

  trackDecision(decision: AuthorizationDecision): void {
    this.evaluatedCount += 1;
    this.totalLatencyMs += decision.latencyMs;

    if (decision.allowed) {
      this.allowedCount += 1;
    } else {
      this.deniedCount += 1;
    }

    if (decision.cacheHit) {
      this.cacheHitCount += 1;
    } else {
      this.cacheMissCount += 1;
    }

    this.reasonCodeCounts[decision.reasonCode] = (this.reasonCodeCounts[decision.reasonCode] ?? 0) + 1;
  }

  trackResolver(name: keyof AuthorizationMetricsSnapshot["resolverStats"]): void {
    this.resolverStats[name] += 1;
  }

  snapshot(): AuthorizationMetricsSnapshot {
    return {
      evaluatedCount: this.evaluatedCount,
      allowedCount: this.allowedCount,
      deniedCount: this.deniedCount,
      cacheHitCount: this.cacheHitCount,
      cacheMissCount: this.cacheMissCount,
      avgLatencyMs: this.evaluatedCount === 0 ? 0 : this.totalLatencyMs / this.evaluatedCount,
      reasonCodeCounts: { ...this.reasonCodeCounts },
      resolverStats: { ...this.resolverStats },
    };
  }
}
