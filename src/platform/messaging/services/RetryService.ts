import type { SubscriptionDefinition } from "../contracts";

export class RetryService {
  constructor(private readonly defaultMaxAttempts = 3) {}

  shouldRetry(definition: SubscriptionDefinition, attempt: number): boolean {
    const maxAttempts = definition.maxAttempts ?? this.defaultMaxAttempts;
    return attempt < maxAttempts;
  }
}
