import type { DeliveryResult, RetryPolicy } from "../contracts";

export type RetryDecision = {
  retry: boolean;
  delaySeconds: number;
  exhausted: boolean;
};

export class RetryService {
  shouldRetry(input: {
    policy: RetryPolicy;
    attemptNumber: number;
    result: DeliveryResult;
  }): RetryDecision {
    const withinAttemptBudget = input.attemptNumber < input.policy.maxAttempts;
    const reason = input.result.reason ?? "unknown";
    const retryableReason = !input.policy.retryableReasons || input.policy.retryableReasons.length === 0
      ? true
      : input.policy.retryableReasons.includes(reason);
    const retry = withinAttemptBudget && input.result.retryable && retryableReason;

    if (!retry) {
      return {
        retry: false,
        delaySeconds: 0,
        exhausted: !withinAttemptBudget,
      };
    }

    const multiplier = input.policy.backoffMultiplier ?? 1;
    const delaySeconds = Math.max(1, Math.round(input.policy.retryDelaySeconds * Math.pow(multiplier, input.attemptNumber - 1)));

    return {
      retry: true,
      delaySeconds,
      exhausted: false,
    };
  }
}
