import type {
  JobRecoveryClassificationResult,
  JobRecoveryExecutionProbe,
  JobRecoverySignals,
} from "./types";

export function classifyRecoveryCandidate(input: {
  execution: JobRecoveryExecutionProbe;
  signals: JobRecoverySignals;
}): JobRecoveryClassificationResult {
  const { execution, signals } = input;

  if (!execution.executionId) {
    return {
      classification: "UNKNOWN",
      reason: "No n8n execution ID is recorded on the job.",
      decision: "MANUAL_REVIEW",
      safeToRecover: false,
      recommendedJobStatus: "MANUAL_INVESTIGATION",
    };
  }

  if (execution.executionExists === true && execution.executionTerminal === false) {
    if (signals.leaseExpired === false && signals.heartbeatStopped === false) {
      return {
        classification: "RUNNING",
        reason: `n8n execution is active (${execution.executionState ?? "RUNNING"}) and lease/heartbeat are active.`,
        decision: "NO_ACTION",
        safeToRecover: false,
        recommendedJobStatus: "KEEP_STARTING",
      };
    }

    return {
      classification: "STUCK",
      reason: `n8n execution is active (${execution.executionState ?? "RUNNING"}) but lease or heartbeat is stale.`,
      decision: "SAFE_RECOVERY",
      safeToRecover: true,
      recommendedJobStatus: "FAILED",
    };
  }

  if (execution.executionExists === true && execution.executionTerminal === true) {
    return {
      classification: "STUCK",
      reason: `n8n execution is terminal (${execution.executionState ?? "TERMINAL"}) but job is still STARTING.`,
      decision: "SAFE_RECOVERY",
      safeToRecover: true,
      recommendedJobStatus: "FAILED",
    };
  }

  if (execution.executionExists === false) {
    if (signals.leaseExpired === true || signals.heartbeatStopped === true) {
      return {
        classification: "ABANDONED",
        reason: "n8n execution is missing and runtime lease/heartbeat is expired.",
        decision: "SAFE_RECOVERY",
        safeToRecover: true,
        recommendedJobStatus: "FAILED",
      };
    }

    return {
      classification: "STUCK",
      reason: "n8n execution is missing but lease/heartbeat does not show a clean expiry yet.",
      decision: "MANUAL_REVIEW",
      safeToRecover: false,
      recommendedJobStatus: "MANUAL_INVESTIGATION",
    };
  }

  return {
    classification: "UNKNOWN",
    reason: execution.reason ?? "Unable to verify n8n execution state from diagnostics.",
    decision: "MANUAL_REVIEW",
    safeToRecover: false,
    recommendedJobStatus: "MANUAL_INVESTIGATION",
  };
}
