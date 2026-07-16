export type RuntimeObjectLifecycleState =
  | "Declared"
  | "Materialized"
  | "Initialized"
  | "Ready"
  | "Active"
  | "Suspended"
  | "Archived"
  | "Failed";

export type RuntimeObjectHealth = "healthy" | "degraded" | "unhealthy";

export type RuntimeObjectLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export interface RuntimeObjectDescriptor {
  descriptorId: string;
  classification: string;
  version: string;
  metadata: Readonly<Record<string, string | number | boolean>>;
  initialState: Readonly<Record<string, unknown>>;
  behaviorRefs: readonly string[];
  capabilityRefs: readonly string[];
  relationshipRefs?: readonly string[];
}

export interface RuntimeObjectRecord {
  objectId: string;
  descriptorId: string;
  classification: string;
  version: string;
  lifecycleState: RuntimeObjectLifecycleState;
  health: RuntimeObjectHealth;
  metadata: Readonly<Record<string, string | number | boolean>>;
  state: Readonly<Record<string, unknown>>;
  relationshipRefs: readonly string[];
  behaviorRefs: readonly string[];
  evidenceRefs: readonly number[];
  snapshotRefs: readonly number[];
  lastFailure?: string;
}

export interface RuntimeRelationshipEdge {
  relationshipId: string;
  sourceObjectId: string;
  relationshipType: string;
  targetObjectId: string;
  attributes: Readonly<Record<string, string | number | boolean>>;
}

export interface RuntimeCapabilityDescriptor {
  capabilityId: string;
  action: string;
  resourcePattern: string;
  allowedStates: readonly RuntimeObjectLifecycleState[];
  requiredPermissions: readonly string[];
}

export interface RuntimeBehaviorDescriptor {
  behaviorId: string;
  capabilityId: string;
  objectClassification: string;
  version: string;
}

export interface RuntimeCapabilityDispatchRequest {
  principal: string;
  objectId: string;
  capabilityId: string;
  payload: Readonly<Record<string, unknown>>;
}

export interface RuntimeCapabilityDispatchResult {
  objectId: string;
  capabilityId: string;
  success: boolean;
  permissionGranted: boolean;
  diagnosticsCode?: string;
  stateTransition?: { from: RuntimeObjectLifecycleState; to: RuntimeObjectLifecycleState };
  output: Readonly<Record<string, unknown>>;
}

export interface RuntimePermissionRule {
  ruleId: string;
  principal: string;
  action: string;
  resource: string;
  effect: "allow" | "deny";
  constraints?: Readonly<Record<string, string | number | boolean>>;
}

export interface RuntimePermissionEvaluation {
  granted: boolean;
  matchedRuleIds: readonly string[];
  denyRuleIds: readonly string[];
  allowRuleIds: readonly string[];
}

export interface RuntimeObjectEvidenceEntry {
  sequence: number;
  runtimeInstanceId: string;
  objectId?: string;
  type:
    | "ObjectCreated"
    | "ObjectTransitioned"
    | "ObjectFailed"
    | "RelationshipAdded"
    | "CapabilityRegistered"
    | "BehaviorRegistered"
    | "PermissionEvaluated"
    | "DispatchAttempted"
    | "DispatchSucceeded"
    | "DispatchFailed"
    | "SnapshotPersisted";
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeObjectDiagnostic {
  sequence: number;
  runtimeInstanceId: string;
  objectId?: string;
  level: RuntimeObjectLogLevel;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeObjectMetrics {
  objectCount: number;
  activeObjectCount: number;
  archivedObjectCount: number;
  failedObjectCount: number;
  relationshipCount: number;
  dispatchSuccessCount: number;
  dispatchFailureCount: number;
  diagnosticsCount: number;
  evidenceCount: number;
  snapshotCount: number;
}

export interface RuntimeObjectTelemetrySnapshot {
  counters: Readonly<Record<string, number>>;
  metrics: RuntimeObjectMetrics;
}

export interface RuntimeObjectSnapshot {
  runtimeInstanceId: string;
  runtimeId: string;
  objects: readonly RuntimeObjectRecord[];
  relationships: readonly RuntimeRelationshipEdge[];
  capabilities: readonly RuntimeCapabilityDescriptor[];
  behaviors: readonly RuntimeBehaviorDescriptor[];
  diagnostics: readonly RuntimeObjectDiagnostic[];
  evidence: readonly RuntimeObjectEvidenceEntry[];
  telemetry: RuntimeObjectTelemetrySnapshot;
}

export interface RuntimeObjectSnapshotRecord {
  revision: number;
  snapshot: RuntimeObjectSnapshot;
}

export interface RuntimeBehaviorExecutionResult {
  output: Readonly<Record<string, unknown>>;
  nextState?: Readonly<Record<string, unknown>>;
  nextLifecycleState?: RuntimeObjectLifecycleState;
  health?: RuntimeObjectHealth;
}

export type RuntimeBehaviorImplementation = (
  object: RuntimeObjectRecord,
  request: RuntimeCapabilityDispatchRequest,
) => RuntimeBehaviorExecutionResult;
