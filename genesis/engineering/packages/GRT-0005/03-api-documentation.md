# GRT-0005 API Documentation

## Envelope Types

Files:
- src/runtime/messaging/RuntimeEnvelope.ts
- src/runtime/messaging/RuntimeCommand.ts
- src/runtime/messaging/RuntimeEvent.ts
- src/runtime/messaging/RuntimeQuery.ts
- src/runtime/messaging/RuntimeReply.ts

Core API:
- snapshot()

Purpose:
- Canonical immutable runtime transport envelope hierarchy.

## RuntimeEnvelopeFactory API

File: src/runtime/messaging/RuntimeEnvelopeFactory.ts
- create(runtimeInstanceId, runtimeId, sequence, intent): RuntimeEnvelope

Purpose:
- Deterministic message identity, correlation defaults, immutable payload/metadata canonicalization, and envelope type materialization.

## RuntimeChannelRegistry API

File: src/runtime/messaging/RuntimeChannelRegistry.ts
- register(descriptor)
- has(channel)
- list()

Purpose:
- Channel governance and deterministic listing.

## RuntimeTopicRegistry API

File: src/runtime/messaging/RuntimeTopicRegistry.ts
- register(descriptor)
- has(channel, topic)
- list()

Purpose:
- Topic governance per channel.

## RuntimeSubscriptionRegistry API

File: src/runtime/messaging/RuntimeSubscriptionRegistry.ts
- register(descriptor)
- list()

Purpose:
- Deterministic/stable subscription management with duplicate rejection.

## RuntimeRouter API

File: src/runtime/messaging/RuntimeRouter.ts
- route(envelope, subscriptions)
- routingTable(subscriptions)

Purpose:
- Deterministic routing and stable route-table projection.

## RuntimeDispatcher API

File: src/runtime/messaging/RuntimeDispatcher.ts
- dispatch(envelope, subscriptions, mode)

Purpose:
- Deterministic delivery outcome derivation (accepted/rejected/dead-letter).

## RuntimeMessageLog API

File: src/runtime/messaging/RuntimeMessageLog.ts
- issueSequence()
- append(record)
- history()
- deadLetterHistory()
- latestSequence()
- hasSequence(sequence)
- count()
- fromSequence(sequence)
- byCorrelationId(correlationId)
- byTopic(channel, topic)

Purpose:
- Append-only message history and deterministic sequence/replay query access.

## RuntimeReplayStore API

File: src/runtime/messaging/RuntimeReplayStore.ts
- save(cursorId, lastSequence)
- get(cursorId)
- list()

Purpose:
- Deterministic replay cursor persistence.

## RuntimeEvidence API

File: src/runtime/messaging/RuntimeEvidence.ts
- append(runtimeInstanceId, type, details, messageId?)
- all()

Purpose:
- Append-only evidence ledger.

## RuntimeDiagnostics API

File: src/runtime/messaging/RuntimeDiagnostics.ts
- log(runtimeInstanceId, level, code, message, details?, messageId?, subscriptionId?)
- all()

Purpose:
- Monotonic diagnostics stream.

## RuntimeTelemetry API

File: src/runtime/messaging/RuntimeTelemetry.ts
- increment(counter, amount?)
- snapshot(metrics)

Purpose:
- Deterministic runtime messaging counters and metrics snapshots.

## RuntimeSnapshotStore API

File: src/runtime/messaging/RuntimeSnapshotStore.ts
- save(snapshot)
- loadLatest(runtimeInstanceId)
- history(runtimeInstanceId)

Purpose:
- Immutable revisioned snapshot persistence.

## RuntimeMessagingManager API

File: src/runtime/messaging/RuntimeMessagingManager.ts
- constructor(runtimeInstanceId, runtimeId)
- static fromExecutionContext(context)
- registerChannel(descriptor)
- registerTopic(descriptor)
- registerSubscription(descriptor)
- registerServiceSubscription(descriptor)
- publish(intent)
- dispatchObjectCapability(objectManager, request, publishIntent?)
- saveReplayCursor(cursorId, lastSequence)
- replayFromSequence(sequence)
- replayFromCursor(cursorId)
- replayByCorrelationId(correlationId)
- replayByTopic(channel, topic)
- snapshot()
- persistSnapshot()
- restoreLatestSnapshot()
- snapshotHistory()
- listMessages()
- listDeadLetters()

Purpose:
- Context-local runtime messaging orchestration with deterministic publish/route/dispatch/replay behavior and governed service/object integration.
