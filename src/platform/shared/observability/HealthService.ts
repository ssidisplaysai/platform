import type { HealthCheck, HealthReport, HealthStatus } from "../contracts";
import { compareDeterministicStrings } from "../utilities";

type HealthCheckProvider = {
  checkId: string;
  run(): Promise<HealthCheck>;
};

export class HealthService {
  private readonly providers: HealthCheckProvider[] = [];

  register(checkId: string, run: () => Promise<HealthCheck>): void {
    this.providers.push({ checkId, run });
  }

  async snapshot(): Promise<HealthReport> {
    const checks: HealthCheck[] = [];
    for (const provider of [...this.providers].sort((left, right) => compareDeterministicStrings(left.checkId, right.checkId))) {
      checks.push(await provider.run());
    }

    const hasFail = checks.some((check) => check.status === "FAIL");
    const hasWarn = checks.some((check) => check.status === "WARN");
    const status: HealthStatus = hasFail ? "FAILED" : hasWarn ? "DEGRADED" : "HEALTHY";

    return {
      status,
      generatedAt: new Date().toISOString(),
      checks,
    };
  }
}
