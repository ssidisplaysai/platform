import type { RuntimePolicyResolutionRequest, RuntimePolicyResolutionResult } from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyResolver {
  resolve(request: RuntimePolicyResolutionRequest): RuntimePolicyResolutionResult {
    const sorted = [...request.policyIrCandidates].sort((a, b) => a.runtimePolicyIrId.localeCompare(b.runtimePolicyIrId));
    if (sorted.length === 0) {
      throw new Error("GRT-POL-RES-001: No RuntimePolicyIR candidates available.");
    }

    const seen = new Set<string>();
    for (const candidate of sorted) {
      if (seen.has(candidate.runtimePolicyIrId)) {
        throw new Error(`GRT-POL-RES-002: Duplicate RuntimePolicyIR candidate detected: ${candidate.runtimePolicyIrId}`);
      }
      seen.add(candidate.runtimePolicyIrId);
    }

    const exact = sorted.find((entry) => entry.runtimePolicyIrId === request.policyRuntimeId);
    const selected = exact ?? sorted[sorted.length - 1];

    return deepFreeze({
      runtimePolicyIr: selected,
      candidateCount: sorted.length,
      selectedBy: exact ? "ExactRuntimeId" : "MostRecentDeterministic",
    });
  }
}
