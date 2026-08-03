import { randomUUID } from "node:crypto";
import type {
  ChannelPreference,
  NotificationDefinition,
  NotificationProcessingResult,
  NotificationRequest,
  NotificationState,
  QuietHoursPolicy,
  TemplateDefinition,
} from "../contracts";
import type { NotificationPersistence, NotificationRequestRecord } from "../persistence";
import type { NotificationProviderRegistry } from "../providers";
import { AttemptTracker } from "./AttemptTracker";
import { ChannelRouter } from "./ChannelRouter";
import { DeadLetterService } from "./DeadLetterService";
import { DedupeService } from "./DedupeService";
import { Lifecycle } from "./Lifecycle";
import { NotificationAuditWriter } from "./NotificationAuditWriter";
import { NotificationHealthService } from "./NotificationHealthService";
import { NotificationMetricsService } from "./NotificationMetricsService";
import { NotificationRegistry } from "./NotificationRegistry";
import { PreferencePolicy } from "./PreferencePolicy";
import { RecipientResolver } from "./RecipientResolver";
import { RetryService } from "./RetryService";
import { SuppressionService } from "./SuppressionService";
import { TemplateRegistry } from "./TemplateRegistry";
import { TemplateRenderer } from "./TemplateRenderer";

export type NotificationEngineOptions = {
  persistence: NotificationPersistence;
  providers: NotificationProviderRegistry;
};

export class NotificationEngine {
  private readonly registry: NotificationRegistry;
  private readonly templates: TemplateRegistry;
  private readonly renderer = new TemplateRenderer();
  private readonly resolver = new RecipientResolver();
  private readonly preferences = new PreferencePolicy();
  private readonly suppression: SuppressionService;
  private readonly router = new ChannelRouter();
  private readonly lifecycle = new Lifecycle();
  private readonly attempts: AttemptTracker;
  private readonly retry = new RetryService();
  private readonly deadLetters: DeadLetterService;
  private readonly dedupe: DedupeService;
  private readonly audits: NotificationAuditWriter;
  private readonly metrics: NotificationMetricsService;
  private readonly health: NotificationHealthService;

  constructor(private readonly options: NotificationEngineOptions) {
    this.registry = new NotificationRegistry(options.persistence);
    this.templates = new TemplateRegistry(options.persistence);
    this.suppression = new SuppressionService(options.persistence);
    this.attempts = new AttemptTracker(options.persistence);
    this.deadLetters = new DeadLetterService(options.persistence);
    this.dedupe = new DedupeService(options.persistence);
    this.audits = new NotificationAuditWriter(options.persistence);
    this.metrics = new NotificationMetricsService(options.persistence);
    this.health = new NotificationHealthService(options.persistence, options.providers);
  }

  capabilityMetadata() {
    return {
      capabilityId: "platform.notifications",
      capabilityName: "Genesis Notification Platform",
      version: "1.0.0",
      deliveryModel: "DURABLE_ATTEMPT_TRACKED",
      providers: this.options.providers.listProviders().map((provider) => provider.capability.providerName),
    };
  }

  async registerDefinition(definition: NotificationDefinition): Promise<void> {
    await this.registry.register(definition);
    await this.metrics.increment("registeredNotificationDefinitions", 1);
  }

  async registerTemplate(template: TemplateDefinition): Promise<void> {
    await this.templates.register(template);
    await this.metrics.increment("registeredTemplates", 1);
  }

  async upsertSuppressionRule(rule: Parameters<SuppressionService["upsertRule"]>[0]): Promise<void> {
    await this.suppression.upsertRule(rule);
  }

  async queueRequest(input: Omit<NotificationRequest, "requestId" | "requestedAt">): Promise<NotificationRequest> {
    const request: NotificationRequest = {
      ...input,
      requestId: `nreq_${randomUUID()}`,
      requestedAt: new Date().toISOString(),
    };

    await this.options.persistence.requests.upsert({
      request,
      state: "REQUESTED",
      updatedAt: new Date().toISOString(),
    });

    await this.writeAuditWithRetry({
      requestId: request.requestId,
      notificationId: request.notificationId,
      eventType: "REQUEST_RECEIVED",
      actorId: request.actorId,
      tenant: request.tenant,
      workspace: request.workspace,
      correlationId: request.correlationId,
      causationId: request.causationId,
      message: "notification request queued",
      details: { idempotencyKey: request.idempotencyKey },
    });

    await this.metrics.increment("requestedNotifications", 1);
    return request;
  }

  async processRequest(requestId: string, context?: {
    preferencesByRecipient?: Record<string, ChannelPreference>;
    quietHoursByRecipient?: Record<string, QuietHoursPolicy>;
  }): Promise<NotificationProcessingResult> {
    const existing = await this.options.persistence.requests.findByRequestId(requestId);
    if (!existing) {
      throw new Error("notification request not found");
    }

    let workingRecord = existing;

    const duplicate = await this.dedupe.isDuplicate(workingRecord.request.idempotencyKey)
      && workingRecord.state !== "REQUESTED";
    if (duplicate) {
      await this.metrics.increment("duplicateRequestCount", 1);
      return {
        requestId,
        state: workingRecord.state,
        deliveredCount: 0,
        failedCount: 0,
        suppressed: false,
        deferred: false,
        duplicate: true,
        auditFailures: 0,
        auditRetries: 0,
        auditTerminalFailure: false,
      };
    }

    const definition = await this.registry.findById(workingRecord.request.notificationId);
    if (!definition) {
      workingRecord = await this.transition(workingRecord, "FAILED", "unknown notification definition");
      throw new Error("unknown notification definition");
    }

    this.lifecycle.requireTransition(workingRecord.state, "VALIDATED");
    workingRecord = await this.transition(workingRecord, "VALIDATED");

    const resolution = this.resolver.resolve(workingRecord.request.recipients);
    if (resolution.unresolved.length > 0) {
      await this.writeAuditWithRetry({
        requestId,
        notificationId: definition.notificationId,
        eventType: "RECIPIENT_UNRESOLVED",
        actorId: workingRecord.request.actorId,
        tenant: workingRecord.request.tenant,
        workspace: workingRecord.request.workspace,
        correlationId: workingRecord.request.correlationId,
        causationId: workingRecord.request.causationId,
        message: "one or more recipients could not be resolved",
        details: { unresolved: resolution.unresolved },
      });
    }

    if (resolution.resolved.length === 0) {
      workingRecord = await this.transition(workingRecord, "FAILED", "no resolved recipients");
      throw new Error("no resolved recipients");
    }

    const now = new Date();
    let deliveredCount = 0;
    let failedCount = 0;
    let suppressed = false;
    let deferred = false;

    for (const recipient of resolution.resolved) {
      const preference = context?.preferencesByRecipient?.[recipient.recipientId];
      const quiet = context?.quietHoursByRecipient?.[recipient.recipientId];
      const priority = workingRecord.request.priority ?? definition.defaultPriority;
      const preferenceDecision = this.preferences.decide({
        recipient,
        definition,
        preference,
        quietHours: quiet,
        priority,
        now,
      });

      if (preferenceDecision.rejected) {
        failedCount += 1;
        await this.metrics.increment("preferenceRejections", 1);
        continue;
      }

      if (preferenceDecision.deferredUntil) {
        deferred = true;
        this.lifecycle.requireTransition(workingRecord.state, "DEFERRED");
        workingRecord = await this.transition(workingRecord, "DEFERRED", undefined, preferenceDecision.deferredUntil);
        await this.metrics.increment("deferredNotifications", 1);
        await this.metrics.increment("quietHourDeferrals", 1);
        continue;
      }

      const routes = this.router.route({
        definition,
        recipient,
        candidateChannels: preferenceDecision.channels,
      });

      if (routes.length === 0) {
        failedCount += 1;
        workingRecord = await this.transition(workingRecord, "FAILED", "no channel routes");
        continue;
      }

      for (const route of routes) {
        const suppression = await this.suppression.evaluate({
          tenant: workingRecord.request.tenant,
          workspace: workingRecord.request.workspace,
          recipientId: recipient.recipientId,
          channel: route.channel,
          notificationType: definition.notificationType,
          nowIso: now.toISOString(),
        });

        if (suppression.suppressed) {
          suppressed = true;
          await this.metrics.increment("suppressedNotifications", 1);
          await this.writeAuditWithRetry({
            requestId,
            notificationId: definition.notificationId,
            eventType: "SUPPRESSED",
            actorId: workingRecord.request.actorId,
            tenant: workingRecord.request.tenant,
            workspace: workingRecord.request.workspace,
            correlationId: workingRecord.request.correlationId,
            causationId: workingRecord.request.causationId,
            message: "notification suppressed",
            details: {
              recipientId: recipient.recipientId,
              channel: route.channel,
              reason: suppression.reason,
            },
          });
          continue;
        }

        const templateId = definition.templateByChannel[route.channel];
        if (!templateId) {
          failedCount += 1;
          continue;
        }

        const template = await this.templates.findById(templateId);
        if (!template) {
          failedCount += 1;
          continue;
        }

        const rendered = this.renderer.render({
          template,
          payload: workingRecord.request.payload,
        });

        const provider = this.options.providers.getProvider(route.channel);
        if (!provider) {
          failedCount += 1;
          await this.metrics.increment("providerFailures", 1);
          continue;
        }

        if (workingRecord.state !== "QUEUED") {
          this.lifecycle.requireTransition(workingRecord.state, "QUEUED");
          workingRecord = await this.transition(workingRecord, "QUEUED");
        }
        await this.metrics.increment("queuedNotifications", 1);

        const priorAttempts = await this.attempts.listAttempts(requestId);
        const attemptNumber = priorAttempts.length + 1;
        const dedupeKey = this.dedupe.createDeliveryDedupeKey({
          requestId,
          recipientId: recipient.recipientId,
          channel: route.channel,
          attemptNumber,
        });

        const createdAttempt = await this.attempts.createAttempt({
          requestId,
          recipientId: recipient.recipientId,
          channel: route.channel,
          providerName: provider.capability.providerName,
          dedupeKey,
          correlationId: workingRecord.request.correlationId,
          causationId: workingRecord.request.causationId,
        });

        await this.metrics.increment("deliveryAttempts", 1);
        const deliveryStart = Date.now();
        const result = await provider.send({
          requestId,
          recipientId: recipient.recipientId,
          address: route.address,
          message: rendered,
          metadata: {
            tenant: workingRecord.request.tenant,
            workspace: workingRecord.request.workspace,
          },
        });

        await this.attempts.completeAttempt(requestId, createdAttempt.attemptId, result);

        if (result.status === "DELIVERED") {
          deliveredCount += 1;
          await this.metrics.recordDelivery(route.channel, true, Date.now() - deliveryStart);
          await this.writeAuditWithRetry({
            requestId,
            notificationId: definition.notificationId,
            eventType: "DELIVERY_SUCCEEDED",
            actorId: workingRecord.request.actorId,
            tenant: workingRecord.request.tenant,
            workspace: workingRecord.request.workspace,
            correlationId: workingRecord.request.correlationId,
            causationId: workingRecord.request.causationId,
            message: "notification delivered",
            details: {
              recipientId: recipient.recipientId,
              channel: route.channel,
              providerName: result.providerName,
              externalId: result.externalId,
            },
          });
          continue;
        }

        failedCount += 1;
        await this.metrics.recordDelivery(route.channel, false, Date.now() - deliveryStart);
        const retryDecision = this.retry.shouldRetry({
          policy: definition.retryPolicy,
          attemptNumber,
          result,
        });

        if (retryDecision.retry) {
          await this.metrics.increment("retryCount", 1);
          await this.writeAuditWithRetry({
            requestId,
            notificationId: definition.notificationId,
            eventType: "RETRY_SCHEDULED",
            actorId: workingRecord.request.actorId,
            tenant: workingRecord.request.tenant,
            workspace: workingRecord.request.workspace,
            correlationId: workingRecord.request.correlationId,
            causationId: workingRecord.request.causationId,
            message: "retry scheduled",
            details: {
              recipientId: recipient.recipientId,
              channel: route.channel,
              delaySeconds: retryDecision.delaySeconds,
            },
          });
          continue;
        }

        if (retryDecision.exhausted || !result.retryable) {
          await this.deadLetters.create({
            requestId,
            reason: result.reason ?? "delivery_failed",
            finalAttemptNumber: attemptNumber,
            recoverable: result.retryable,
            metadata: {
              channel: route.channel,
            },
          });
          await this.metrics.increment("deadLetteredNotifications", 1);
          await this.writeAuditWithRetry({
            requestId,
            notificationId: definition.notificationId,
            eventType: "DEAD_LETTER_CREATED",
            actorId: workingRecord.request.actorId,
            tenant: workingRecord.request.tenant,
            workspace: workingRecord.request.workspace,
            correlationId: workingRecord.request.correlationId,
            causationId: workingRecord.request.causationId,
            message: "delivery moved to dead letter",
            details: {
              recipientId: recipient.recipientId,
              channel: route.channel,
              reason: result.reason,
            },
          });
        }
      }
    }

    const finalState: NotificationState = failedCount > 0 && deliveredCount > 0
      ? "PARTIALLY_DELIVERED"
      : failedCount > 0
        ? "FAILED"
        : deliveredCount > 0
          ? "DELIVERED"
          : suppressed
            ? "SUPPRESSED"
            : deferred
              ? "DEFERRED"
              : "FAILED";

    if (this.lifecycle.canTransition(workingRecord.state, finalState)) {
      workingRecord = await this.transition(workingRecord, finalState);
    }

    return {
      requestId,
      state: finalState,
      deliveredCount,
      failedCount,
      suppressed,
      deferred,
      duplicate: false,
      auditFailures: this.getAuditFailureCount(),
      auditRetries: this.getAuditRetryCount(),
      auditTerminalFailure: this.getAuditTerminalFailureCount() > 0,
    };
  }

  async processPending(nowIso = new Date().toISOString()): Promise<NotificationProcessingResult[]> {
    const pending = await this.options.persistence.requests.listPending(nowIso);
    const results: NotificationProcessingResult[] = [];

    for (const item of pending) {
      results.push(await this.processRequest(item.request.requestId));
    }

    return results;
  }

  async listRequests(): Promise<NotificationRequestRecord[]> {
    return this.options.persistence.requests.list();
  }

  async listDeadLetters() {
    return this.options.persistence.deadLetters.list();
  }

  async getMetrics() {
    return this.metrics.getMetrics();
  }

  async healthSnapshot() {
    return this.health.snapshot();
  }

  async getOperationalReadiness() {
    const requests = await this.listRequests();
    const deadLetters = await this.listDeadLetters();

    return {
      queueDepth: requests.filter((item) => item.state === "QUEUED").length,
      deferredDepth: requests.filter((item) => item.state === "DEFERRED").length,
      deadLetterDepth: deadLetters.length,
      durability: "FILE_PERSISTED",
      idempotency: "IDEMPOTENCY_KEY_ENFORCED",
      providerMode: "IN_MEMORY_ADAPTERS",
    };
  }

  async getAuditTrail(limit = 200) {
    return this.options.persistence.audits.list(limit);
  }

  private async transition(
    record: NotificationRequestRecord,
    nextState: NotificationState,
    lastError?: string,
    deferredUntil?: string,
  ): Promise<NotificationRequestRecord> {
    const updated: NotificationRequestRecord = {
      ...record,
      state: nextState,
      updatedAt: new Date().toISOString(),
      lastError,
      deferredUntil,
    };
    await this.options.persistence.requests.upsert(updated);
    return updated;
  }

  async runRecoveryAudit(actorId = "system"): Promise<void> {
    const snapshot = await this.options.persistence.recover();
    if (snapshot.diagnostics.length === 0) {
      return;
    }

    await this.metrics.increment("recoveryCount", 1);
    await this.writeAuditManyWithRetry(snapshot.diagnostics.map((diagnostic) => ({
      eventType: diagnostic.severity === "ERROR" ? "CORRUPT_STATE_DETECTED" : "RECOVERY_PERFORMED",
      actorId,
      tenant: "system",
      workspace: "system",
      message: diagnostic.message,
      details: {
        scope: diagnostic.scope,
        severity: diagnostic.severity,
      },
    })));
  }

  private auditFailureCount = 0;
  private auditRetryCount = 0;
  private auditTerminalFailureCount = 0;

  private getAuditFailureCount(): number {
    return this.auditFailureCount;
  }

  private getAuditRetryCount(): number {
    return this.auditRetryCount;
  }

  private getAuditTerminalFailureCount(): number {
    return this.auditTerminalFailureCount;
  }

  private async writeAuditWithRetry(record: Parameters<NotificationAuditWriter["write"]>[0]): Promise<void> {
    const startedAt = Date.now();
    try {
      await this.audits.write(record);
      await this.safeRecordAuditLatency(Date.now() - startedAt);
      if (this.auditFailureCount > 0) {
        await this.safeRecordAuditRecovery();
        this.auditFailureCount -= 1;
      }
      return;
    } catch (error) {
      const retryable = this.isAuditRetryable(error);
      this.auditFailureCount += 1;
      await this.safeRecordAuditFailure(retryable);
      if (retryable) {
        this.auditRetryCount += 1;
        try {
          await this.audits.write(record);
          await this.safeRecordAuditLatency(Date.now() - startedAt);
          await this.safeRecordAuditRecovery();
          if (this.auditFailureCount > 0) {
            this.auditFailureCount -= 1;
          }
          return;
        } catch (retryError) {
          this.auditFailureCount += 1;
          this.auditTerminalFailureCount += 1;
          await this.safeRecordAuditFailure(this.isAuditRetryable(retryError));
          await this.safeRecordAuditLatency(Date.now() - startedAt);
          return;
        }
      }

      this.auditTerminalFailureCount += 1;
      await this.safeRecordAuditLatency(Date.now() - startedAt);
    }
  }

  private async writeAuditManyWithRetry(records: Parameters<NotificationAuditWriter["writeMany"]>[0]): Promise<void> {
    for (const record of records) {
      await this.writeAuditWithRetry(record);
    }
  }

  private isAuditRetryable(error: unknown): boolean {
    if (typeof error === "object" && error !== null && "retryable" in error && typeof (error as { retryable?: unknown }).retryable === "boolean") {
      return (error as { retryable: boolean }).retryable;
    }

    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return message.includes("timeout") || message.includes("temporar") || message.includes("unavailable") || message.includes("enoent");
  }

  private async safeRecordAuditFailure(retryable: boolean): Promise<void> {
    try {
      await this.metrics.recordAuditFailure(retryable);
    } catch {
      this.auditTerminalFailureCount += 1;
    }
  }

  private async safeRecordAuditRecovery(): Promise<void> {
    try {
      await this.metrics.recordAuditRecovery();
    } catch {
      this.auditTerminalFailureCount += 1;
    }
  }

  private async safeRecordAuditLatency(latencyMs: number): Promise<void> {
    try {
      await this.metrics.recordAuditLatency(latencyMs);
    } catch {
      this.auditTerminalFailureCount += 1;
    }
  }
}
