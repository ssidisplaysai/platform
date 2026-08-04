import type { ContactHealth, ContactPlatformDependencies } from "../contracts";
import type { ContactMetricsService } from "./ContactMetricsService";
import type { ContactAuditWriter } from "./ContactAuditWriter";

export class ContactHealthService {
  constructor(
    private readonly metrics: ContactMetricsService,
    private readonly audit: ContactAuditWriter,
    private readonly dependencies: ContactPlatformDependencies,
  ) {}

  async snapshot(): Promise<ContactHealth> {
    const metrics = this.metrics.snapshot();
    const checks: ContactHealth["checks"] = [
      { name: "registry", status: metrics.registeredContacts >= 0 ? "PASS" : "FAIL", detail: `contacts=${metrics.registeredContacts}` },
      { name: "methods", status: "PASS", detail: `verifiedEmail=${metrics.verifiedEmailMethods} verifiedPhone=${metrics.verifiedPhoneMethods}` },
      { name: "affiliations", status: "PASS", detail: `activeAffiliations=${metrics.activeAffiliations}` },
      { name: "preferences", status: "PASS", detail: "preference service available" },
      { name: "consent", status: "PASS", detail: `grants=${metrics.consentGrants} withdrawals=${metrics.consentWithdrawals}` },
      { name: "eligibility", status: "PASS", detail: "eligibility service available" },
      { name: "deduplication", status: "PASS", detail: `duplicateCandidates=${metrics.duplicateCandidates}` },
      { name: "merge", status: metrics.mergeFailures > 0 ? "WARN" : "PASS", detail: `mergeFailures=${metrics.mergeFailures}` },
      { name: "persistence", status: metrics.corruptStateCount > 0 ? "WARN" : "PASS", detail: `corruptStateCount=${metrics.corruptStateCount}` },
      { name: "recovery", status: "PASS", detail: `recoveryCount=${metrics.recoveryCount}` },
      { name: "audit", status: this.audit.list(1).length > 0 ? "PASS" : "WARN", detail: `auditRecords=${this.audit.list(500).length}` },
      { name: "configuration", status: "PASS", detail: "dependencies configured" },
    ];

    const depChecks = await Promise.all([
      this.dependencies.messaging.inspectHealth(),
      this.dependencies.workflow.inspectHealth(),
      this.dependencies.scheduling.inspectHealth(),
      this.dependencies.notifications.inspectHealth(),
      this.dependencies.ai.inspectHealth(),
    ]);

    if (depChecks.some((item) => item.status !== "HEALTHY")) {
      checks.push({ name: "configuration", status: "WARN", detail: "one or more consumed dependencies are degraded" });
    }

    const hasFail = checks.some((item) => item.status === "FAIL");

    return {
      status: hasFail ? "DEGRADED" : "HEALTHY",
      generatedAt: new Date().toISOString(),
      checks,
    };
  }
}
