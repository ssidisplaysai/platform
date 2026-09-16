type ReconciliationResult = {
  stateCode: string;
  cityName?: string | null;
  action: string;
  error?: string;
};

export function summarizeCampaignReconciliation(
  results: readonly ReconciliationResult[],
) {
  const count = (action: string) => results.filter((entry) => entry.action === action).length;
  const summary = {
    contentReady: count("content_ready"),
    draftReady: count("draft_ready"),
    waiting: count("wait"),
    recoverable: count("requeued"),
    failed: count("failed"),
    blocked: results.filter((entry) => entry.action === "error" || entry.action === "continue_error").length,
  };
  const classified = Object.values(summary).reduce((total, value) => total + value, 0);
  const unknown = results.length - classified;
  const details = results
    .filter((entry) => entry.action === "failed" || entry.action === "error" || entry.action === "continue_error" || !["content_ready", "draft_ready", "wait", "requeued"].includes(entry.action))
    .map((entry) => `${entry.cityName ? `${entry.cityName}, ${entry.stateCode}` : entry.stateCode}: ${entry.error ?? entry.action}`);
  const message = `Reconciliation: CONTENT READY ${summary.contentReady} · DRAFT READY ${summary.draftReady} · WAITING ${summary.waiting} · RECOVERABLE ${summary.recoverable} · FAILED ${summary.failed} · BLOCKED ${summary.blocked + unknown}.`;

  return {
    message: details.length > 0 ? `${message} ${details.join(" | ")}` : message,
    requiresAttention: summary.failed > 0 || summary.blocked > 0 || unknown > 0,
  };
}