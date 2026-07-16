import type { RuntimeExecutionContext } from "../services";
import type { RuntimeCapabilityDispatchRequest, RuntimeCapabilityDispatchResult, RuntimeObjectManager } from "../objects";
import { RuntimeChannelRegistry } from "./RuntimeChannelRegistry";
import { RuntimeDiagnostics } from "./RuntimeDiagnostics";
import { RuntimeDispatcher } from "./RuntimeDispatcher";
import { RuntimeEnvelopeFactory } from "./RuntimeEnvelopeFactory";
import { RuntimeEvidence } from "./RuntimeEvidence";
import { RuntimeMessageLog } from "./RuntimeMessageLog";
import { RuntimeReplayStore } from "./RuntimeReplayStore";
import { RuntimeRouter } from "./RuntimeRouter";
import { RuntimeSnapshotStore } from "./RuntimeSnapshotStore";
import { RuntimeSubscriptionRegistry } from "./RuntimeSubscriptionRegistry";
import { RuntimeTelemetry } from "./RuntimeTelemetry";
import { RuntimeTopicRegistry } from "./RuntimeTopicRegistry";
import type {
  RuntimeChannelDescriptor,
  RuntimeMessagingMetrics,
  RuntimeMessagingSnapshot,
  RuntimeMessagingSnapshotRecord,
  RuntimeObjectDispatchPublishResult,
  RuntimeObjectPublishIntent,
  RuntimePublishIntent,
  RuntimePublishResult,
  RuntimeReplayCursor,
  RuntimeReplayResult,
  RuntimeSubscriptionDescriptor,
  RuntimeTopicDescriptor,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function isWildcardPattern(pattern: string): boolean {
  return pattern === "*" || pattern.endsWith(".*");
}

export class RuntimeMessagingManager {
  private readonly channels = new RuntimeChannelRegistry();
  private readonly topics = new RuntimeTopicRegistry();
  private readonly subscriptions = new RuntimeSubscriptionRegistry();
  private readonly router = new RuntimeRouter();
  private readonly dispatcher = new RuntimeDispatcher();
  private readonly log = new RuntimeMessageLog();
  private readonly replay = new RuntimeReplayStore();
  private readonly evidence = new RuntimeEvidence();
  private readonly diagnostics = new RuntimeDiagnostics();
  private readonly telemetry = new RuntimeTelemetry();
  private readonly snapshots = new RuntimeSnapshotStore();
  private readonly envelopes = new RuntimeEnvelopeFactory();

  constructor(
    readonly runtimeInstanceId: string,
    readonly runtimeId: string,
  ) {}

  static fromExecutionContext(context: RuntimeExecutionContext): RuntimeMessagingManager {
    return new RuntimeMessagingManager(context.runtimeInstanceId, context.runtimeId);
  }

  registerChannel(descriptor: RuntimeChannelDescriptor): void {
    this.channels.register(descriptor);
    this.telemetry.increment("channel.registered");
    this.evidence.append(this.runtimeInstanceId, "ChannelRegistered", { channel: descriptor.channel });
  }

  registerTopic(descriptor: RuntimeTopicDescriptor): void {
    if (!this.channels.has(descriptor.channel)) {
      throw new Error(`GRT-MSG-MANAGER-001: Unknown channel for topic registration: ${descriptor.channel}`);
    }
    this.topics.register(descriptor);
    this.telemetry.increment("topic.registered");
    this.evidence.append(this.runtimeInstanceId, "TopicRegistered", { channel: descriptor.channel, topic: descriptor.topic });
  }

  registerSubscription(descriptor: RuntimeSubscriptionDescriptor): void {
    if (!this.channels.has(descriptor.channel)) {
      throw new Error(`GRT-MSG-MANAGER-002: Unknown channel for subscription: ${descriptor.channel}`);
    }
    if (!isWildcardPattern(descriptor.topicPattern) && !this.topics.has(descriptor.channel, descriptor.topicPattern)) {
      throw new Error(`GRT-MSG-MANAGER-003: Unknown topic for subscription: ${descriptor.channel}:${descriptor.topicPattern}`);
    }
    this.subscriptions.register(descriptor);
    this.telemetry.increment("subscription.registered");
    this.evidence.append(this.runtimeInstanceId, "SubscriptionRegistered", {
      subscriptionId: descriptor.subscriptionId,
      channel: descriptor.channel,
      topicPattern: descriptor.topicPattern,
    });
  }

  registerServiceSubscription(descriptor: {
    subscriptionId: string;
    channel: string;
    topicPattern: string;
    serviceId: string;
    acceptedEnvelopeTypes: RuntimeSubscriptionDescriptor["acceptedEnvelopeTypes"];
    version: string;
    deliveryPolicy?: "accept" | "reject";
  }): void {
    this.registerSubscription({
      subscriptionId: descriptor.subscriptionId,
      channel: descriptor.channel,
      topicPattern: descriptor.topicPattern,
      subscriberKind: "RuntimeService",
      subscriberId: descriptor.serviceId,
      acceptedEnvelopeTypes: descriptor.acceptedEnvelopeTypes,
      version: descriptor.version,
      deliveryPolicy: descriptor.deliveryPolicy,
    });
  }

  publish(intent: RuntimePublishIntent): RuntimePublishResult {
    if (!this.channels.has(intent.channel)) {
      this.diagnostics.log(this.runtimeInstanceId, "Error", "GRT-MSG-PUB-001", "Unknown channel", { channel: intent.channel });
      throw new Error(`GRT-MSG-PUB-001: Unknown channel: ${intent.channel}`);
    }
    if (!this.topics.has(intent.channel, intent.topic)) {
      this.diagnostics.log(this.runtimeInstanceId, "Error", "GRT-MSG-PUB-002", "Unknown topic", { channel: intent.channel, topic: intent.topic });
      throw new Error(`GRT-MSG-PUB-002: Unknown topic: ${intent.channel}:${intent.topic}`);
    }

    const sequence = this.log.issueSequence();
    const envelope = this.envelopes.create(this.runtimeInstanceId, this.runtimeId, sequence, intent).snapshot();
    this.telemetry.increment("message.published");
    this.evidence.append(this.runtimeInstanceId, "EnvelopePublished", {
      channel: envelope.channel,
      topic: envelope.topic,
      envelopeType: envelope.envelopeType,
      sequence: envelope.sequence,
    }, envelope.messageId);

    const matches = this.router.route(envelope, this.subscriptions.list());
    this.telemetry.increment("message.routed", matches.length);
    this.evidence.append(this.runtimeInstanceId, "EnvelopeRouted", {
      routeCount: matches.length,
    }, envelope.messageId);

    const dispatched = this.dispatcher.dispatch(envelope, matches, "publish");
    for (const delivery of dispatched.deliveries) {
      if (delivery.status === "Rejected") {
        this.telemetry.increment("message.failed");
        this.diagnostics.log(
          this.runtimeInstanceId,
          "Warning",
          "GRT-MSG-DISPATCH-003",
          "Delivery rejected",
          { subscriberId: delivery.subscriberId },
          envelope.messageId,
          delivery.subscriptionId,
        );
        this.evidence.append(this.runtimeInstanceId, "EnvelopeRejected", { subscriptionId: delivery.subscriptionId }, envelope.messageId);
        continue;
      }
      this.telemetry.increment("message.delivered");
      this.evidence.append(this.runtimeInstanceId, "EnvelopeDelivered", { subscriptionId: delivery.subscriptionId }, envelope.messageId);
    }

    if (matches.length === 0) {
      this.telemetry.increment("message.failed");
      this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-MSG-DISPATCH-001", "Missing subscriber", {
        channel: envelope.channel,
        topic: envelope.topic,
      }, envelope.messageId);
    }

    if (dispatched.deadLettered) {
      this.telemetry.increment("message.deadlettered");
      this.evidence.append(this.runtimeInstanceId, "EnvelopeDeadLettered", {
        channel: envelope.channel,
        topic: envelope.topic,
      }, envelope.messageId);
    }

    const stored = this.log.append({
      envelope,
      deliveries: dispatched.deliveries,
      deadLettered: dispatched.deadLettered,
    });

    return deepFreeze({
      envelope: stored.envelope,
      deliveries: stored.deliveries,
      deadLettered: stored.deadLettered,
    });
  }

  dispatchObjectCapability(
    objectManager: RuntimeObjectManager,
    request: RuntimeCapabilityDispatchRequest,
    publishIntent?: RuntimeObjectPublishIntent,
  ): RuntimeObjectDispatchPublishResult {
    const dispatchResult = objectManager.dispatch(request) as RuntimeCapabilityDispatchResult;
    if (!dispatchResult.success || !publishIntent) {
      return deepFreeze({ dispatchResult });
    }

    const publishResult = this.publish({
      ...publishIntent,
      publisherKind: "RuntimeObject",
      publisherId: request.objectId,
    });
    this.evidence.append(this.runtimeInstanceId, "ObjectDispatchPublished", {
      objectId: request.objectId,
      capabilityId: request.capabilityId,
      messageId: publishResult.envelope.messageId,
    }, publishResult.envelope.messageId);

    return deepFreeze({
      dispatchResult,
      publishResult,
    });
  }

  saveReplayCursor(cursorId: string, lastSequence: number): RuntimeReplayCursor {
    if (lastSequence > this.log.latestSequence()) {
      this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-MSG-REPLAY-004", "Invalid replay cursor sequence", {
        cursorId,
        lastSequence,
      });
      throw new Error(`GRT-MSG-REPLAY-004: Replay cursor sequence is beyond history: ${lastSequence}`);
    }
    const cursor = this.replay.save(cursorId, lastSequence);
    this.evidence.append(this.runtimeInstanceId, "ReplayCursorSaved", { cursorId, lastSequence });
    return cursor;
  }

  replayFromSequence(sequence: number): RuntimeReplayResult {
    if (sequence < 1 || (!this.log.hasSequence(sequence) && this.log.count() > 0)) {
      this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-MSG-REPLAY-005", "Invalid replay sequence", { sequence });
      throw new Error(`GRT-MSG-REPLAY-005: Invalid replay sequence: ${sequence}`);
    }
    return this.replayRecords("sequence", this.log.fromSequence(sequence));
  }

  replayFromCursor(cursorId: string): RuntimeReplayResult {
    const cursor = this.replay.get(cursorId);
    const records = this.log.fromSequence(cursor.lastSequence + 1);
    const result = this.replayRecords("cursor", records);
    const last = records[records.length - 1]?.envelope.sequence ?? cursor.lastSequence;
    this.replay.save(cursorId, last);
    return result;
  }

  replayByCorrelationId(correlationId: string): RuntimeReplayResult {
    return this.replayRecords("correlation", this.log.byCorrelationId(correlationId));
  }

  replayByTopic(channel: string, topic: string): RuntimeReplayResult {
    return this.replayRecords("topic", this.log.byTopic(channel, topic));
  }

  snapshot(): RuntimeMessagingSnapshot {
    const messages = this.log.history();
    const deadLetters = this.log.deadLetterHistory();
    const subscriptions = this.subscriptions.list();
    const metrics: RuntimeMessagingMetrics = {
      channelCount: this.channels.list().length,
      topicCount: this.topics.list().length,
      subscriptionCount: subscriptions.length,
      messageCount: messages.length,
      deadLetterCount: deadLetters.length,
      replayCursorCount: this.replay.list().length,
      diagnosticsCount: this.diagnostics.all().length,
      evidenceCount: this.evidence.all().length,
      deliveryCount: messages.reduce((count, entry) => count + entry.deliveries.length, 0),
    };

    return deepFreeze({
      runtimeInstanceId: this.runtimeInstanceId,
      runtimeId: this.runtimeId,
      messages,
      deadLetters,
      channels: this.channels.list(),
      topics: this.topics.list(),
      subscriptions,
      routingTable: this.router.routingTable(subscriptions),
      replayCursors: this.replay.list(),
      diagnostics: this.diagnostics.all(),
      evidence: this.evidence.all(),
      telemetry: this.telemetry.snapshot(metrics),
    });
  }

  persistSnapshot(): RuntimeMessagingSnapshotRecord {
    const record = this.snapshots.save(this.snapshot());
    this.telemetry.increment("message.snapshot.persisted");
    this.evidence.append(this.runtimeInstanceId, "SnapshotPersisted", { revision: record.revision });
    return record;
  }

  restoreLatestSnapshot(): RuntimeMessagingSnapshotRecord {
    return this.snapshots.loadLatest(this.runtimeInstanceId);
  }

  snapshotHistory(): readonly RuntimeMessagingSnapshotRecord[] {
    return this.snapshots.history(this.runtimeInstanceId);
  }

  listMessages() {
    return this.log.history();
  }

  listDeadLetters() {
    return this.log.deadLetterHistory();
  }

  private replayRecords(
    mode: RuntimeReplayResult["mode"],
    records: readonly ReturnType<RuntimeMessageLog["history"]>[number][],
  ): RuntimeReplayResult {
    this.evidence.append(this.runtimeInstanceId, "ReplayStarted", { mode, count: records.length });
    const replayed = records.map((record) => {
      const matches = this.router.route(record.envelope, this.subscriptions.list());
      const dispatched = this.dispatcher.dispatch(record.envelope, matches, "replay");
      this.telemetry.increment("message.replayed");
      for (const delivery of dispatched.deliveries) {
        if (delivery.status === "Rejected") {
          this.telemetry.increment("message.failed");
          this.diagnostics.log(this.runtimeInstanceId, "Warning", "GRT-MSG-DISPATCH-003", "Delivery rejected", {
            subscriberId: delivery.subscriberId,
            replay: true,
          }, record.envelope.messageId, delivery.subscriptionId);
          continue;
        }
        this.telemetry.increment("message.delivered");
      }
      this.evidence.append(this.runtimeInstanceId, "EnvelopeReplayed", {
        mode,
        sequence: record.envelope.sequence,
        routeCount: matches.length,
      }, record.envelope.messageId);
      return deepFreeze({
        envelope: record.envelope,
        deliveries: dispatched.deliveries,
        deadLettered: dispatched.deadLettered,
      });
    });

    return deepFreeze({
      mode,
      replayed,
    });
  }
}
