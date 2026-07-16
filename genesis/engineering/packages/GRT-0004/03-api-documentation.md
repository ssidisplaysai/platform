# GRT-0004 API Documentation

## RuntimeObject API

File: src/runtime/objects/RuntimeObject.ts
- constructor(record: RuntimeObjectRecord)
- snapshot(): RuntimeObjectRecord
- evolve(changes: Partial<RuntimeObjectRecord>): RuntimeObject

Purpose:
- Canonical immutable runtime object entity.

## RuntimeObjectFactory API

File: src/runtime/objects/RuntimeObjectFactory.ts
- identityFor(descriptor: RuntimeObjectDescriptor): string
- create(descriptor: RuntimeObjectDescriptor): RuntimeObject
- evolve(record: RuntimeObjectRecord, changes: Partial<RuntimeObjectRecord>): RuntimeObject

Purpose:
- Deterministic identity creation and immutable object evolution.

## RuntimeObjectRegistry API

File: src/runtime/objects/RuntimeObjectRegistry.ts
- register(descriptor: RuntimeObjectDescriptor): RuntimeObjectRecord
- update(record: RuntimeObjectRecord): void
- get(objectId: string): RuntimeObjectRecord
- has(objectId: string): boolean
- list(): readonly RuntimeObjectRecord[]

Purpose:
- Deterministic object registration, storage, and lookup.

## RuntimeRelationshipEngine API

File: src/runtime/objects/RuntimeRelationshipEngine.ts
- addRelationship(sourceObjectId, relationshipType, targetObjectId, attributes?, exists?): RuntimeRelationshipEdge
- list(): readonly RuntimeRelationshipEdge[]

Purpose:
- Deterministic relationship identity/order management with duplicate rejection.

## RuntimeBehaviorRegistry API

File: src/runtime/objects/RuntimeBehaviorRegistry.ts
- registerCapability(descriptor): void
- registerBehavior(descriptor, implementation): void
- resolveBehavior(capabilityId: string, classification: string)
- capability(capabilityId: string)
- listCapabilities()
- listBehaviors()

Purpose:
- Separates capability declarations from behavior implementations and resolves behavior deterministically.

## RuntimeCapabilityDispatcher API

File: src/runtime/objects/RuntimeCapabilityDispatcher.ts
- dispatch(runtimeInstanceId, request, dependencies): RuntimeCapabilityDispatchResult

Purpose:
- Executes capabilities only through permission/lifecycle/behavior-gated pipeline.

## RuntimePermissionEvaluator API

File: src/runtime/objects/RuntimePermissionEvaluator.ts
- registerRule(rule: RuntimePermissionRule): void
- evaluate(request): RuntimePermissionEvaluation

Purpose:
- Separate deterministic permission evaluation subsystem.

## RuntimeObjectStateMachine API

File: src/runtime/objects/RuntimeObjectStateMachine.ts
- canTransition(from, to): boolean
- transition(from, to, objectId): RuntimeObjectLifecycleState

Purpose:
- Strict lifecycle transition enforcement.

## RuntimeObjectDiagnostics API

File: src/runtime/objects/RuntimeObjectDiagnostics.ts
- log(runtimeInstanceId, level, code, message, objectId?, details?): void
- all(): readonly RuntimeObjectDiagnostic[]

Purpose:
- Monotonic diagnostics stream.

## RuntimeObjectTelemetry API

File: src/runtime/objects/RuntimeObjectTelemetry.ts
- increment(counter: string, amount?: number): void
- snapshot(metrics: RuntimeObjectMetrics): RuntimeObjectTelemetrySnapshot

Purpose:
- Deterministic runtime-object metrics and counters.

## RuntimeObjectEvidence API

File: src/runtime/objects/RuntimeObjectEvidence.ts
- append(runtimeInstanceId, type, details, objectId?): RuntimeObjectEvidenceEntry
- all(): readonly RuntimeObjectEvidenceEntry[]

Purpose:
- Append-only runtime-object evidence ledger.

## RuntimeObjectSnapshotStore API

File: src/runtime/objects/RuntimeObjectSnapshotStore.ts
- save(snapshot: RuntimeObjectSnapshot): RuntimeObjectSnapshotRecord
- loadLatest(runtimeInstanceId: string): RuntimeObjectSnapshotRecord
- history(runtimeInstanceId: string): readonly RuntimeObjectSnapshotRecord[]

Purpose:
- Immutable revisioned snapshot persistence.

## RuntimeObjectManager API

File: src/runtime/objects/RuntimeObjectManager.ts
- constructor(runtimeInstanceId: string, runtimeId: string)
- static fromExecutionContext(context: RuntimeExecutionContext): RuntimeObjectManager
- registerObject(descriptor)
- initializeObject(objectId)
- readyObject(objectId)
- activateObject(objectId)
- suspendObject(objectId)
- archiveObject(objectId)
- failObject(objectId, reason)
- registerPermission(rule)
- registerCapability(descriptor)
- registerBehavior(descriptor, implementation)
- dispatch(request)
- addRelationship(sourceObjectId, relationshipType, targetObjectId, attributes?)
- snapshot()
- persistSnapshot()
- restoreLatestSnapshot()
- snapshotHistory()
- getObject(objectId)
- listObjects()

Purpose:
- Context-owned orchestration for object lifecycle, capability dispatch, permission gating, relationships, evidence, diagnostics, telemetry, and snapshots.
