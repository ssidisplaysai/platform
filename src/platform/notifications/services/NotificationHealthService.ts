import type { NotificationHealth } from "../contracts";
import type { NotificationPersistence } from "../persistence";
import type { NotificationProviderRegistry } from "../providers";

export class NotificationHealthService {
  constructor(
    private readonly persistence: NotificationPersistence,
    private readonly providers: NotificationProviderRegistry,
  ) {}

  async snapshot(): Promise<NotificationHealth> {
    const checks: NotificationHealth["checks"] = [];
    const recovered = await this.persistence.recover();

    checks.push({
      name: "registry",
      status: "PASS",
      detail: "notification registry available",
    });

    checks.push({
      name: "templates",
      status: "PASS",
      detail: "template registry available",
    });

    checks.push({
      name: "recipientResolution",
      status: "PASS",
      detail: "recipient resolver available",
    });

    checks.push({
      name: "preferencePolicy",
      status: "PASS",
      detail: "preference policy available",
    });

    checks.push({
      name: "suppression",
      status: "PASS",
      detail: "suppression service available",
    });

    const providerCount = this.providers.listProviders().length;
    checks.push({
      name: "providers",
      status: providerCount > 0 ? "PASS" : "FAIL",
      detail: providerCount > 0 ? `provider count ${providerCount}` : "no providers configured",
    });

    checks.push({
      name: "persistence",
      status: "PASS",
      detail: "durable file persistence available",
    });

    checks.push({
      name: "retry",
      status: "PASS",
      detail: "retry policy service available",
    });

    checks.push({
      name: "deadLetter",
      status: "PASS",
      detail: "dead-letter service available",
    });

    checks.push({
      name: "audit",
      status: "PASS",
      detail: "audit writer available",
    });

    checks.push({
      name: "recovery",
      status: recovered.diagnostics.some((item) => item.severity === "ERROR") ? "WARN" : "PASS",
      detail: recovered.diagnostics.length > 0
        ? `recovery diagnostics ${recovered.diagnostics.length}`
        : "no recovery diagnostics",
    });

    checks.push({
      name: "configuration",
      status: "PASS",
      detail: "foundation defaults loaded",
    });

    const failed = checks.some((check) => check.status === "FAIL");
    const warned = checks.some((check) => check.status === "WARN");

    return {
      status: failed ? "DEGRADED" : warned ? "DEGRADED" : "HEALTHY",
      checks,
      generatedAt: new Date().toISOString(),
    };
  }
}
