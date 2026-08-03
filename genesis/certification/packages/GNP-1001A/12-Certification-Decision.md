# 12 Certification Decision

Decision: CERTIFIED WITH CONDITIONS

Conditions:

C1
Finding:
- Template rendering injects a random `renderId` into the rendered variable payload.

Impact:
- Identical input does not always produce identical rendered output, which reduces determinism and reproducibility for certification evidence and audit review.

Evidence:
- `src/platform/notifications/services/TemplateRenderer.ts` appends `renderId: randomUUID()` to rendered variables.

Remediation objective:
- Remove non-deterministic render metadata from the rendered content model or relocate it to deterministic operational metadata outside the template result.

C2
Finding:
- Audit failure visibility is modeled but not fully enforced in the delivery path.

Impact:
- A persistence failure in the audit writer may not be explicitly surfaced through the declared audit-failure metric or audit-failure event path.

Evidence:
- `src/platform/notifications/services/NotificationMetricsService.ts` defines `auditFailures`, but `src/platform/notifications/services/NotificationAuditWriter.ts` does not catch append failures or increment the metric.

Remediation objective:
- Add explicit audit-failure capture, metric incrementing, and observable failure emission in the audit writer or engine path.
