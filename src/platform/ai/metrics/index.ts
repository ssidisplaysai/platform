import type { AIHealthStatus, AIProviderName, AIMetricsSnapshot } from "../contracts";
import { createDefaultAIMetrics } from "../contracts";

export class AIMetricsService {
  constructor(private readonly snapshotState: AIMetricsSnapshot = createDefaultAIMetrics()) {}

  snapshot(): AIMetricsSnapshot {
    return structuredClone(this.snapshotState);
  }

  increment(field: keyof AIMetricsSnapshot, amount = 1): void {
    const current = this.snapshotState[field];
    if (typeof current === "number") {
      (this.snapshotState[field] as number) = current + amount;
    }
  }

  recordExecution(status: "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT" | "WAITING_FOR_APPROVAL", latencyMs: number): void {
    this.increment("executionCount", 1);
    if (status === "COMPLETED") {
      this.increment("completedCount", 1);
    }
    if (status === "FAILED") {
      this.increment("failedCount", 1);
    }
    if (status === "CANCELLED") {
      this.increment("cancelledCount", 1);
    }
    if (status === "TIMED_OUT") {
      this.increment("timedOutCount", 1);
    }
    if (status === "WAITING_FOR_APPROVAL") {
      this.increment("waitingForApprovalCount", 1);
    }
    this.snapshotState.averageLatencyMs = Math.round((this.snapshotState.averageLatencyMs + latencyMs) / 2);
  }

  recordTokens(inputTokens: number, outputTokens: number, cost: number): void {
    this.snapshotState.tokenInputCount += inputTokens;
    this.snapshotState.tokenOutputCount += outputTokens;
    this.snapshotState.tokenTotalCount += inputTokens + outputTokens;
    this.snapshotState.costTotal = Number((this.snapshotState.costTotal + cost).toFixed(4));
  }

  recordPromptRender(): void {
    this.increment("promptRenderCount", 1);
  }

  recordToolExecution(): void {
    this.increment("toolExecutionCount", 1);
  }

  recordFallback(): void {
    this.increment("fallbackCount", 1);
  }

  recordRetry(): void {
    this.increment("retryCount", 1);
  }

  recordBudgetExhausted(): void {
    this.increment("budgetExhaustedCount", 1);
  }

  recordBudgetRejected(): void {
    this.increment("budgetRejectedCount", 1);
  }

  recordAuthorizationDenied(): void {
    this.increment("authorizationDeniedCount", 1);
  }

  recordAuthorizationError(): void {
    this.increment("authorizationErrorCount", 1);
  }

  recordOutputValidationFailure(): void {
    this.increment("outputValidationFailureCount", 1);
  }

  recordProviderHealth(providerName: AIProviderName, status: AIHealthStatus, latencyMs?: number): void {
    this.snapshotState.providerHealth[providerName] = status;
    if (latencyMs !== undefined) {
      this.snapshotState.providerLatencyMs[providerName] = latencyMs;
    }
  }

  recordModelUsage(modelId: string): void {
    this.snapshotState.modelUsage[modelId] = (this.snapshotState.modelUsage[modelId] ?? 0) + 1;
  }
}
