import { summarizeCampaignReconciliation } from "../campaign-reconciliation-ui-summary";

describe("campaign reconciliation operator summary", () => {
  test("surfaces recovered content-ready execution instead of zero draft-ready and zero waiting", () => {
    expect(summarizeCampaignReconciliation([
      { stateCode: "CA", action: "content_ready" },
    ])).toEqual({
      message: "Reconciliation: CONTENT READY 1 · DRAFT READY 0 · WAITING 0 · RECOVERABLE 0 · FAILED 0 · BLOCKED 0.",
      requiresAttention: false,
    });
  });

  test("classifies every supported reconciliation outcome", () => {
    const result = summarizeCampaignReconciliation([
      { stateCode: "AA", action: "content_ready" },
      { stateCode: "BB", action: "draft_ready" },
      { stateCode: "CC", action: "wait" },
      { stateCode: "DD", action: "requeued" },
      { stateCode: "EE", action: "failed", error: "Execution failed." },
      { stateCode: "FF", action: "continue_error", error: "Continuation blocked." },
    ]);

    expect(result.message).toContain("CONTENT READY 1 · DRAFT READY 1 · WAITING 1 · RECOVERABLE 1 · FAILED 1 · BLOCKED 1");
    expect(result.message).toContain("EE: Execution failed.");
    expect(result.message).toContain("FF: Continuation blocked.");
    expect(result.requiresAttention).toBe(true);
  });

  test("fails visible for an unknown server action", () => {
    expect(summarizeCampaignReconciliation([
      { stateCode: "AA", action: "unclassified_state" },
    ])).toEqual({
      message: "Reconciliation: CONTENT READY 0 · DRAFT READY 0 · WAITING 0 · RECOVERABLE 0 · FAILED 0 · BLOCKED 1. AA: unclassified_state",
      requiresAttention: true,
    });
  });
});