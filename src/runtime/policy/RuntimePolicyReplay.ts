import { RuntimePolicyEvaluator } from "./RuntimePolicyEvaluator";
import type {
  RuntimePolicyDecision,
  RuntimePolicyEvaluationContext,
  RuntimePolicyFactIR,
  RuntimePolicyIR,
  RuntimePolicyReplayResult,
} from "./types";
import { createDigest, deepFreeze } from "./types";

export class RuntimePolicyReplay {
  constructor(private readonly evaluator = new RuntimePolicyEvaluator()) {}

  replay(runtimePolicyIr: RuntimePolicyIR, facts: readonly RuntimePolicyFactIR[], context: RuntimePolicyEvaluationContext): RuntimePolicyDecision {
    return this.evaluator.evaluate({ runtimePolicyIr, facts, context });
  }

  verify(
    runtimePolicyIr: RuntimePolicyIR,
    facts: readonly RuntimePolicyFactIR[],
    context: RuntimePolicyEvaluationContext,
    baseline: RuntimePolicyDecision,
  ): RuntimePolicyReplayResult {
    const replayed = this.replay(runtimePolicyIr, facts, context);
    const baselineDecisionDigest = createDigest(baseline);
    const replayDecisionDigest = createDigest(replayed);
    const baselineTraceDigest = createDigest(baseline.trace);
    const replayTraceDigest = createDigest(replayed.trace);
    const baselineFactsDigest = createDigest(baseline.factDigests);
    const replayFactsDigest = createDigest(replayed.factDigests);
    const baselineArtifactDigest = createDigest({
      decision: baseline.decision,
      decisionDigest: baselineDecisionDigest,
      trace: baseline.trace,
      matchedPolicyIds: baseline.matchedPolicyIds,
      matchedRuleIds: baseline.matchedRuleIds,
      obligations: baseline.obligations,
      factsDigest: baselineFactsDigest,
      policyDigest: runtimePolicyIr.runtimePolicyIrDigest,
      decisionTraceDigest: baselineTraceDigest,
    });
    const replayArtifactDigest = createDigest({
      decision: replayed.decision,
      decisionDigest: replayDecisionDigest,
      trace: replayed.trace,
      matchedPolicyIds: replayed.matchedPolicyIds,
      matchedRuleIds: replayed.matchedRuleIds,
      obligations: replayed.obligations,
      factsDigest: replayFactsDigest,
      policyDigest: runtimePolicyIr.runtimePolicyIrDigest,
      decisionTraceDigest: replayTraceDigest,
    });
    const replayDigest = createDigest({
      baselineArtifactDigest,
      replayArtifactDigest,
    });

    return deepFreeze({
      replayDigest,
      matched: baselineArtifactDigest === replayArtifactDigest,
      leftDecisionId: baseline.decisionId,
      rightDecisionId: replayed.decisionId,
      leftDecisionDigest: baselineDecisionDigest,
      rightDecisionDigest: replayDecisionDigest,
      leftTraceDigest: baselineTraceDigest,
      rightTraceDigest: replayTraceDigest,
      leftPolicyDigest: runtimePolicyIr.runtimePolicyIrDigest,
      rightPolicyDigest: runtimePolicyIr.runtimePolicyIrDigest,
      leftFactsDigest: baselineFactsDigest,
      rightFactsDigest: replayFactsDigest,
    });
  }
}
