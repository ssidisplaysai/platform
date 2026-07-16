import type { RuntimeExecutionContext } from "../services";
import { RuntimeCapabilityDispatcher } from "./RuntimeCapabilityDispatcher";
import { RuntimeObjectDiagnostics } from "./RuntimeObjectDiagnostics";
import { RuntimeObjectEvidence } from "./RuntimeObjectEvidence";
import { RuntimeObjectFactory } from "./RuntimeObjectFactory";
import { RuntimeObjectRegistry } from "./RuntimeObjectRegistry";
import { RuntimeObjectSnapshotStore } from "./RuntimeObjectSnapshotStore";
import { RuntimeObjectStateMachine } from "./RuntimeObjectStateMachine";
import { RuntimeObjectTelemetry } from "./RuntimeObjectTelemetry";
import { RuntimePermissionEvaluator } from "./RuntimePermissionEvaluator";
import { RuntimeRelationshipEngine } from "./RuntimeRelationshipEngine";
import { RuntimeBehaviorRegistry } from "./RuntimeBehaviorRegistry";
import type {
  RuntimeCapabilityDispatchRequest,
  RuntimeCapabilityDispatchResult,
  RuntimeObjectDescriptor,
  RuntimeObjectLifecycleState,
  RuntimeObjectRecord,
  RuntimeObjectSnapshot,
  RuntimeObjectSnapshotRecord,
  RuntimePermissionRule,
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

export class RuntimeObjectManager {
  private readonly objectFactory = new RuntimeObjectFactory();
  private readonly stateMachine = new RuntimeObjectStateMachine();
  private readonly registry = new RuntimeObjectRegistry();
  private readonly relationshipEngine = new RuntimeRelationshipEngine();
  private readonly behaviorRegistry = new RuntimeBehaviorRegistry();
  private readonly capabilityDispatcher = new RuntimeCapabilityDispatcher();
  private readonly permissionEvaluator = new RuntimePermissionEvaluator();
  private readonly diagnostics = new RuntimeObjectDiagnostics();
  private readonly telemetry = new RuntimeObjectTelemetry();
  private readonly evidence = new RuntimeObjectEvidence();
  private readonly snapshots = new RuntimeObjectSnapshotStore();

  constructor(
    readonly runtimeInstanceId: string,
    readonly runtimeId: string,
  ) {}

  static fromExecutionContext(context: RuntimeExecutionContext): RuntimeObjectManager {
    return new RuntimeObjectManager(context.runtimeInstanceId, context.runtimeId);
  }

  registerObject(descriptor: RuntimeObjectDescriptor): RuntimeObjectRecord {
    const declared = this.registry.register(descriptor);
    const materialized = this.objectFactory.evolve(declared, {
      lifecycleState: this.stateMachine.transition(declared.lifecycleState, "Materialized", declared.objectId),
    }).snapshot();

    this.registry.update(materialized);
    this.telemetry.increment("object.created");
    const evidence = this.evidence.append(this.runtimeInstanceId, "ObjectCreated", { descriptorId: descriptor.descriptorId }, materialized.objectId);

    const withEvidence = this.objectFactory.evolve(materialized, {
      evidenceRefs: Object.freeze([...materialized.evidenceRefs, evidence.sequence]),
    }).snapshot();
    this.registry.update(withEvidence);
    return withEvidence;
  }

  initializeObject(objectId: string): RuntimeObjectRecord {
    return this.transitionObject(objectId, "Initialized", "object.initialized");
  }

  readyObject(objectId: string): RuntimeObjectRecord {
    return this.transitionObject(objectId, "Ready", "object.ready");
  }

  activateObject(objectId: string): RuntimeObjectRecord {
    return this.transitionObject(objectId, "Active", "object.activated");
  }

  suspendObject(objectId: string): RuntimeObjectRecord {
    return this.transitionObject(objectId, "Suspended", "object.suspended");
  }

  archiveObject(objectId: string): RuntimeObjectRecord {
    return this.transitionObject(objectId, "Archived", "object.archived");
  }

  failObject(objectId: string, reason: string): RuntimeObjectRecord {
    const current = this.registry.get(objectId);
    const failed = this.objectFactory.evolve(current, {
      lifecycleState: this.stateMachine.transition(current.lifecycleState, "Failed", objectId),
      health: "unhealthy",
      lastFailure: reason,
    }).snapshot();
    this.registry.update(failed);
    this.telemetry.increment("object.failed");
    this.diagnostics.log(this.runtimeInstanceId, "Error", "GRT-OBJ-002", "Runtime object failed", objectId, { reason });
    this.evidence.append(this.runtimeInstanceId, "ObjectFailed", { reason }, objectId);
    return failed;
  }

  registerPermission(rule: RuntimePermissionRule): void {
    this.permissionEvaluator.registerRule(rule);
  }

  registerCapability(descriptor: {
    capabilityId: string;
    action: string;
    resourcePattern: string;
    allowedStates: readonly RuntimeObjectLifecycleState[];
    requiredPermissions: readonly string[];
  }): void {
    this.behaviorRegistry.registerCapability(descriptor);
    this.telemetry.increment("object.capability.registered");
    this.evidence.append(this.runtimeInstanceId, "CapabilityRegistered", { capabilityId: descriptor.capabilityId });
  }

  registerBehavior(
    descriptor: {
      behaviorId: string;
      capabilityId: string;
      objectClassification: string;
      version: string;
    },
    implementation: (object: RuntimeObjectRecord, request: RuntimeCapabilityDispatchRequest) => {
      output: Readonly<Record<string, unknown>>;
      nextState?: Readonly<Record<string, unknown>>;
      nextLifecycleState?: RuntimeObjectRecord["lifecycleState"];
      health?: RuntimeObjectRecord["health"];
    },
  ): void {
    this.behaviorRegistry.registerBehavior(descriptor, implementation);
    this.telemetry.increment("object.behavior.registered");
    this.evidence.append(this.runtimeInstanceId, "BehaviorRegistered", { behaviorId: descriptor.behaviorId, capabilityId: descriptor.capabilityId });
  }

  dispatch(request: RuntimeCapabilityDispatchRequest): RuntimeCapabilityDispatchResult {
    const result = this.capabilityDispatcher.dispatch(this.runtimeInstanceId, request, {
      registry: this.registry,
      stateMachine: this.stateMachine,
      behaviorRegistry: this.behaviorRegistry,
      permissionEvaluator: this.permissionEvaluator,
      diagnostics: this.diagnostics,
      evidence: this.evidence,
      telemetry: this.telemetry,
    });

    if (!result.success) {
      this.diagnostics.log(this.runtimeInstanceId, "Warning", result.diagnosticsCode ?? "GRT-OBJ-DISPATCH-000", "Capability dispatch failed", request.objectId, {
        capabilityId: request.capabilityId,
      });
    }

    return result;
  }

  addRelationship(
    sourceObjectId: string,
    relationshipType: string,
    targetObjectId: string,
    attributes: Readonly<Record<string, string | number | boolean>> = {},
  ): void {
    const edge = this.relationshipEngine.addRelationship(sourceObjectId, relationshipType, targetObjectId, attributes, (objectId) => this.registry.has(objectId));
    this.telemetry.increment("object.relationships");
    this.evidence.append(this.runtimeInstanceId, "RelationshipAdded", { relationshipId: edge.relationshipId }, sourceObjectId);

    const source = this.registry.get(sourceObjectId);
    const updatedSource = this.objectFactory.evolve(source, {
      relationshipRefs: Object.freeze([...source.relationshipRefs, edge.relationshipId]),
    }).snapshot();
    this.registry.update(updatedSource);
  }

  snapshot(): RuntimeObjectSnapshot {
    const objects = this.registry.list();
    const relationships = this.relationshipEngine.list();

    const metrics = {
      objectCount: objects.length,
      activeObjectCount: objects.filter((entry) => entry.lifecycleState === "Active").length,
      archivedObjectCount: objects.filter((entry) => entry.lifecycleState === "Archived").length,
      failedObjectCount: objects.filter((entry) => entry.lifecycleState === "Failed").length,
      relationshipCount: relationships.length,
      dispatchSuccessCount: this.telemetry.snapshot({
        objectCount: 0,
        activeObjectCount: 0,
        archivedObjectCount: 0,
        failedObjectCount: 0,
        relationshipCount: 0,
        dispatchSuccessCount: 0,
        dispatchFailureCount: 0,
        diagnosticsCount: 0,
        evidenceCount: 0,
        snapshotCount: 0,
      }).counters["object.dispatch.success"] ?? 0,
      dispatchFailureCount: this.telemetry.snapshot({
        objectCount: 0,
        activeObjectCount: 0,
        archivedObjectCount: 0,
        failedObjectCount: 0,
        relationshipCount: 0,
        dispatchSuccessCount: 0,
        dispatchFailureCount: 0,
        diagnosticsCount: 0,
        evidenceCount: 0,
        snapshotCount: 0,
      }).counters["object.dispatch.failure"] ?? 0,
      diagnosticsCount: this.diagnostics.all().length,
      evidenceCount: this.evidence.all().length,
      snapshotCount: this.snapshots.history(this.runtimeInstanceId).length,
    };

    return deepFreeze({
      runtimeInstanceId: this.runtimeInstanceId,
      runtimeId: this.runtimeId,
      objects,
      relationships,
      capabilities: this.behaviorRegistry.listCapabilities().map((entry) => deepFreeze({
        capabilityId: entry.capabilityId,
        action: entry.action,
        resourcePattern: entry.resourcePattern,
        allowedStates: Object.freeze([...entry.allowedStates]),
        requiredPermissions: Object.freeze([...entry.requiredPermissions]),
      })),
      behaviors: this.behaviorRegistry.listBehaviors(),
      diagnostics: this.diagnostics.all(),
      evidence: this.evidence.all(),
      telemetry: this.telemetry.snapshot(metrics),
    });
  }

  persistSnapshot(): RuntimeObjectSnapshotRecord {
    const snapshot = this.snapshot();
    const record = this.snapshots.save(snapshot);
    this.telemetry.increment("object.snapshot.count");
    this.evidence.append(this.runtimeInstanceId, "SnapshotPersisted", { revision: record.revision });
    return record;
  }

  restoreLatestSnapshot(): RuntimeObjectSnapshotRecord {
    return this.snapshots.loadLatest(this.runtimeInstanceId);
  }

  snapshotHistory(): readonly RuntimeObjectSnapshotRecord[] {
    return this.snapshots.history(this.runtimeInstanceId);
  }

  getObject(objectId: string): RuntimeObjectRecord {
    return this.registry.get(objectId);
  }

  listObjects(): readonly RuntimeObjectRecord[] {
    return this.registry.list();
  }

  private transitionObject(objectId: string, nextState: RuntimeObjectRecord["lifecycleState"], counter: string): RuntimeObjectRecord {
    const current = this.registry.get(objectId);
    const transitioned = this.objectFactory.evolve(current, {
      lifecycleState: this.stateMachine.transition(current.lifecycleState, nextState, objectId),
    }).snapshot();

    this.registry.update(transitioned);
    this.telemetry.increment(counter);
    this.evidence.append(this.runtimeInstanceId, "ObjectTransitioned", {
      from: current.lifecycleState,
      to: nextState,
    }, objectId);
    return transitioned;
  }
}
