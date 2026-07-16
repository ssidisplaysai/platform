import type {
  SolutionConfidence,
  SolutionConflict,
  SolutionLineage,
  SolutionProvenance,
  SolutionTemporalValidity,
  SolutionVersion,
  SolutionIR,
} from "../solution/SolutionIR";

export type RuntimeVersion = SolutionVersion;
export type RuntimeLineage = SolutionLineage;
export type RuntimeProvenance = SolutionProvenance;
export type RuntimeConfidence = SolutionConfidence;

export interface RuntimeTemporalValidity extends Omit<SolutionTemporalValidity, "compiledAt"> {
  compiledAt?: string;
}

export interface RuntimeConflict {
  id: string;
  conflictType: string;
  status: "resolved" | "unresolved" | "non_blocking" | "blocking";
  blocking: boolean;
  relatedIds: readonly string[];
}

export type RuntimeDiagnosticSeverity = "info" | "warning" | "error";

export type RuntimeDiagnosticCategory =
  | "identity"
  | "lineage"
  | "provenance"
  | "configuration"
  | "dependency"
  | "provider"
  | "security"
  | "deployment"
  | "environment"
  | "workflow"
  | "event"
  | "scheduler"
  | "monitoring"
  | "health"
  | "determinism"
  | "validation";

export interface RuntimeDiagnostic {
  code: string;
  severity: RuntimeDiagnosticSeverity;
  category: RuntimeDiagnosticCategory;
  message: string;
  sourceObjectId?: string;
  runtimeObjectId?: string;
  path?: string;
  cause?: string;
  suggestedFix?: string;
  blocking: boolean;
}

export interface RuntimeValidationSummary {
  passed: boolean;
  blockingErrorCount: number;
  warningCount: number;
  diagnosticsCount: number;
}

export interface RuntimeCompilationMetrics {
  inputSolutionObjectCount: number;
  runtimeModuleCount: number;
  runtimeApplicationCount: number;
  runtimeServiceCount: number;
  runtimeApiCount: number;
  databaseBindingCount: number;
  storageBindingCount: number;
  messagingBindingCount: number;
  workflowBindingCount: number;
  integrationBindingCount: number;
  schedulerBindingCount: number;
  eventBindingCount: number;
  securityBindingCount: number;
  configurationBindingCount: number;
  providerBindingCount: number;
  pluginBindingCount: number;
  agentBindingCount: number;
  executionGraphNodeCount: number;
  executionGraphEdgeCount: number;
  blockingDiagnosticCount: number;
  warningCount: number;
  validationDurationMs: number;
  compilationDurationMs: number;
  canonicalHash: string;
  passVersion: string;
  compilerVersion: string;
}

export interface RuntimeIdentity {
  id: string;
  kind: string;
  objectType: string;
  sourceSolutionIdentity: string;
  semanticHash: string;
  parentIdentity?: string;
  environmentScope?: string;
  deploymentScope?: string;
  lineageSignature: string;
  versionSemantics: string;
}

export interface RuntimeObjectBase {
  runtimeId: string;
  name: string;
  status: "active" | "inactive" | "planned";
  sourceSolutionObjectId: string;
  version: RuntimeVersion;
  lineage: RuntimeLineage;
  provenance: RuntimeProvenance;
  confidence: RuntimeConfidence;
  temporalValidity: RuntimeTemporalValidity;
  diagnostics: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface RuntimeModule extends RuntimeObjectBase {
  moduleId: string;
}

export interface RuntimeApplication extends RuntimeObjectBase {
  applicationId: string;
  moduleId: string;
}

export interface RuntimeService extends RuntimeObjectBase {
  serviceId: string;
  applicationId: string;
}

export interface RuntimeApi extends RuntimeObjectBase {
  apiId: string;
  serviceId: string;
}

export interface RuntimeDatabaseBinding extends RuntimeObjectBase {
  bindingId: string;
  moduleId: string;
  contract: string;
}

export interface RuntimeStorageBinding extends RuntimeObjectBase {
  bindingId: string;
  providerId: string;
}

export interface RuntimeMessagingBinding extends RuntimeObjectBase {
  bindingId: string;
  providerId: string;
}

export interface RuntimeSearchBinding extends RuntimeObjectBase {
  bindingId: string;
  apiIds: readonly string[];
}

export interface RuntimeWorkflowBinding extends RuntimeObjectBase {
  bindingId: string;
  workflowId: string;
  serviceIds: readonly string[];
}

export interface RuntimeIntegrationBinding extends RuntimeObjectBase {
  bindingId: string;
  sourceServiceId: string;
  targetServiceId: string;
}

export interface RuntimeSchedulerBinding extends RuntimeObjectBase {
  bindingId: string;
  runtimeIdRef: string;
}

export interface RuntimeEventBinding extends RuntimeObjectBase {
  bindingId: string;
  publisherId: string;
  subscriberIds: readonly string[];
}

export interface RuntimeNotificationBinding extends RuntimeObjectBase {
  bindingId: string;
  channelProviderId: string;
}

export interface RuntimeAuthenticationBinding extends RuntimeObjectBase {
  bindingId: string;
  providerId: string;
}

export interface RuntimeAuthorizationBinding extends RuntimeObjectBase {
  bindingId: string;
  policyProviderId: string;
}

export interface RuntimeConfigurationBinding extends RuntimeObjectBase {
  bindingId: string;
  runtimeIdRef: string;
  configurationReferences: readonly string[];
}

export interface RuntimeSecretReference extends RuntimeObjectBase {
  secretReferenceId: string;
  environmentId: string;
  resolutionPolicy: "deferred";
}

export interface RuntimeEnvironment extends RuntimeObjectBase {
  environmentId: string;
}

export interface RuntimeDeploymentTarget extends RuntimeObjectBase {
  deploymentTargetId: string;
  environmentId: string;
}

export interface RuntimeHealthCheck extends RuntimeObjectBase {
  healthCheckId: string;
  targetServiceId: string;
  required: boolean;
}

export interface RuntimeMonitoringBinding extends RuntimeObjectBase {
  bindingId: string;
  targetRuntimeId: string;
}

export interface RuntimeTelemetryBinding extends RuntimeObjectBase {
  bindingId: string;
  targetRuntimeId: string;
}

export interface RuntimeLoggingBinding extends RuntimeObjectBase {
  bindingId: string;
  targetRuntimeId: string;
}

export type RuntimeDependencyScope = "singleton" | "scoped" | "transient" | "external";

export interface RuntimeDependencyBinding extends RuntimeObjectBase {
  bindingId: string;
  consumerId: string;
  providerId: string;
  contract: string;
  scope: RuntimeDependencyScope;
  lifecycle: RuntimeDependencyScope;
  required: boolean;
  configurationReferences: readonly string[];
  dependencyReferences: readonly string[];
}

export interface RuntimeProviderBinding extends RuntimeObjectBase {
  bindingId: string;
  providerId: string;
  contract: string;
  scope: RuntimeDependencyScope;
}

export interface RuntimePluginBinding extends RuntimeObjectBase {
  bindingId: string;
  pluginId: string;
  targetRuntimeId: string;
}

export interface RuntimeAgentBinding extends RuntimeObjectBase {
  bindingId: string;
  agentId: string;
  targetRuntimeId: string;
}

export interface RuntimeActivationUnit {
  unitId: string;
  objectType: string;
  requiredDependencies: readonly string[];
  optionalDependencies: readonly string[];
  readinessGates: readonly string[];
  healthGates: readonly string[];
  retryPolicyRef?: string;
  rollbackHookRefs: readonly string[];
  failureBoundary: string;
  timeoutPolicyRef?: string;
}

export interface RuntimeActivationPhase {
  phase: string;
  order: number;
  serialExecution: boolean;
  parallelizableGroups: readonly string[];
  units: readonly RuntimeActivationUnit[];
}

export interface RuntimeActivationPlan {
  phases: readonly RuntimeActivationPhase[];
}

export interface RuntimeShutdownPlan {
  orderedSteps: readonly string[];
}

export interface RuntimeRecoveryPlan {
  orderedSteps: readonly string[];
}

export type RuntimeExecutionEdgeType =
  | "requires"
  | "initializes_before"
  | "subscribes_to"
  | "publishes_to"
  | "binds_to"
  | "authenticates_through"
  | "authorizes_through"
  | "stores_in"
  | "reads_from"
  | "writes_to"
  | "monitors"
  | "schedules"
  | "invokes"
  | "recovers_with";

export interface RuntimeExecutionNode {
  nodeId: string;
  runtimeObjectId: string;
  objectType: string;
  environmentId?: string;
  deploymentTargetId?: string;
}

export interface RuntimeExecutionEdge {
  edgeId: string;
  from: string;
  to: string;
  edgeType: RuntimeExecutionEdgeType;
}

export interface RuntimeExecutionGraph {
  nodes: readonly RuntimeExecutionNode[];
  edges: readonly RuntimeExecutionEdge[];
  hasCycle: boolean;
  orphanNodeIds: readonly string[];
  violations: readonly string[];
}

export interface EnterpriseRuntime {
  runtimeId: string;
  solutionId: string;
  blueprintId: string;
  businessGenomeId: string;
  enterpriseId: string;
  name: string;
  version: string;
  status: "active" | "inactive" | "planned";
  modules: readonly RuntimeModule[];
  applications: readonly RuntimeApplication[];
  services: readonly RuntimeService[];
  apis: readonly RuntimeApi[];
  databaseBindings: readonly RuntimeDatabaseBinding[];
  storageBindings: readonly RuntimeStorageBinding[];
  messagingBindings: readonly RuntimeMessagingBinding[];
  searchBindings: readonly RuntimeSearchBinding[];
  workflowBindings: readonly RuntimeWorkflowBinding[];
  integrationBindings: readonly RuntimeIntegrationBinding[];
  schedulerBindings: readonly RuntimeSchedulerBinding[];
  eventBindings: readonly RuntimeEventBinding[];
  notificationBindings: readonly RuntimeNotificationBinding[];
  authenticationBindings: readonly RuntimeAuthenticationBinding[];
  authorizationBindings: readonly RuntimeAuthorizationBinding[];
  configurationBindings: readonly RuntimeConfigurationBinding[];
  secretReferences: readonly RuntimeSecretReference[];
  environments: readonly RuntimeEnvironment[];
  deploymentTargets: readonly RuntimeDeploymentTarget[];
  healthChecks: readonly RuntimeHealthCheck[];
  monitoringBindings: readonly RuntimeMonitoringBinding[];
  telemetryBindings: readonly RuntimeTelemetryBinding[];
  loggingBindings: readonly RuntimeLoggingBinding[];
  dependencyBindings: readonly RuntimeDependencyBinding[];
  providerBindings: readonly RuntimeProviderBinding[];
  pluginBindings: readonly RuntimePluginBinding[];
  agentBindings: readonly RuntimeAgentBinding[];
  activationPlan: RuntimeActivationPlan;
  shutdownPlan: RuntimeShutdownPlan;
  recoveryPlan: RuntimeRecoveryPlan;
  executionGraph: RuntimeExecutionGraph;
  lineage: RuntimeLineage;
  provenance: RuntimeProvenance;
  confidence: RuntimeConfidence;
  temporalValidity: RuntimeTemporalValidity;
  diagnostics: readonly RuntimeDiagnostic[];
  validation: RuntimeValidationSummary;
  metadata: Readonly<Record<string, unknown>>;
}

export interface RuntimeCompilationContext {
  compilerVersion: string;
  passVersion: string;
  pipelineVersion: string;
  compiledAt: string;
  sourceSolutionHash: string;
  sourceObjectCount: number;
  sourceIds: readonly string[];
  deterministicRunId: string;
}

export interface EnterpriseRuntimeIR {
  schemaVersion: "1.0.0";
  enterpriseRuntime: EnterpriseRuntime;
  compilationContext: RuntimeCompilationContext;
  diagnostics: readonly RuntimeDiagnostic[];
  metrics: RuntimeCompilationMetrics;
  validation: RuntimeValidationSummary;
  deterministicHash: string;
  deterministicSerialization: string;
  compiledFromSolutionHash: string;
  generatedAt: string;
}

export interface RuntimeCompilationResult {
  success: boolean;
  enterpriseRuntimeIR: EnterpriseRuntimeIR;
  diagnostics: readonly RuntimeDiagnostic[];
  metrics: RuntimeCompilationMetrics;
  validation: RuntimeValidationSummary;
  hash: string;
  compilationMetadata: RuntimeCompilationContext;
}

export interface RuntimeCompilerOptions {
  compilerVersion?: string;
  pipelineVersion?: string;
  passVersion?: string;
  compiledAt?: string;
}

export type RuntimeInput = SolutionIR;

export function toRuntimeConflict(conflict: SolutionConflict): RuntimeConflict {
  const status = conflict.status === "blocking"
    ? "blocking"
    : conflict.status === "resolved"
      ? "resolved"
      : conflict.status === "non_blocking"
        ? "non_blocking"
        : "unresolved";

  return {
    id: conflict.id,
    conflictType: conflict.conflictType,
    status,
    blocking: conflict.blocking || status === "blocking",
    relatedIds: [...conflict.relatedIds].sort((a, b) => a.localeCompare(b)),
  };
}
