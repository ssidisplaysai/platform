import type {
  BlueprintConfidence,
  BlueprintLineage,
  BlueprintProvenance,
  BlueprintTemporalValidity,
  BlueprintVersion,
  EnterpriseBlueprintIR,
} from "../blueprint/BlueprintIR";

export type SolutionDiagnosticSeverity = "info" | "warning" | "error";

export interface SolutionDiagnostic {
  code: string;
  severity: SolutionDiagnosticSeverity;
  message: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface SolutionIdentity {
  id: string;
  kind: string;
  objectType: string;
  sourceBlueprintIdentity: string;
  semanticHash: string;
  versionSemantics: string;
}

export type SolutionVersion = BlueprintVersion;
export type SolutionLineage = BlueprintLineage;
export type SolutionProvenance = BlueprintProvenance;
export type SolutionConfidence = BlueprintConfidence;
export type SolutionTemporalValidity = BlueprintTemporalValidity;

export interface SolutionConflict {
  id: string;
  conflictType: string;
  status: "resolved" | "unresolved" | "blocking" | "non_blocking";
  blocking: boolean;
  relatedIds: readonly string[];
}

export interface SolutionObjectBase {
  identity: SolutionIdentity;
  semanticType: string;
  name: string;
  content: string;
  ownerId: string;
  version: SolutionVersion;
  lineage: SolutionLineage;
  provenance: SolutionProvenance;
  confidence: SolutionConfidence;
  temporalValidity: SolutionTemporalValidity;
  conflicts: readonly SolutionConflict[];
  blueprintReferences: readonly string[];
  compilerStage: "stage-6-solution-compiler";
  compilerVersion: string;
  validationStatus: "valid" | "warning" | "invalid";
  diagnosticReferences: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface ApplicationSolution extends SolutionObjectBase {
  moduleId: string;
  serviceIds: readonly string[];
}

export interface ModuleSolution extends SolutionObjectBase {
  applicationIds: readonly string[];
}

export interface ServiceSolution extends SolutionObjectBase {
  applicationId: string;
  apiIds: readonly string[];
}

export interface ApiSolution extends SolutionObjectBase {
  serviceId: string;
}

export interface DatabaseSolution extends SolutionObjectBase {
  moduleId: string;
}

export interface WorkflowSolution extends SolutionObjectBase {
  serviceIds: readonly string[];
}

export interface IntegrationSolution extends SolutionObjectBase {
  sourceServiceId: string;
  targetServiceId: string;
}

export interface ReportingSolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface PortalSolution extends SolutionObjectBase {
  applicationId: string;
}

export interface AutomationSolution extends SolutionObjectBase {
  workflowId: string;
}

export interface AuthenticationSolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface AuthorizationSolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface NotificationSolution extends SolutionObjectBase {
  messagingId: string;
}

export interface SearchSolution extends SolutionObjectBase {
  apiIds: readonly string[];
}

export interface StorageSolution extends SolutionObjectBase {
  databaseIds: readonly string[];
}

export interface MessagingSolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface ConfigurationSolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface DeploymentSolution extends SolutionObjectBase {
  runtimeIds: readonly string[];
}

export interface RuntimeSolution extends SolutionObjectBase {
  deploymentIds: readonly string[];
}

export interface MonitoringSolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface SecuritySolution extends SolutionObjectBase {
  runtimeId: string;
}

export interface SolutionDependencyNode {
  id: string;
  type: string;
  ownerId: string;
}

export interface SolutionDependencyEdge {
  from: string;
  to: string;
  relation: string;
}

export interface SolutionDependencyGraph {
  nodes: readonly SolutionDependencyNode[];
  edges: readonly SolutionDependencyEdge[];
  hasCycle: boolean;
  cyclePaths: readonly string[];
  violations: readonly string[];
}

export interface EnterpriseSolution {
  enterpriseId: string;
  solutionId: string;
  name: string;
  version: string;
  applications: readonly ApplicationSolution[];
  modules: readonly ModuleSolution[];
  services: readonly ServiceSolution[];
  apis: readonly ApiSolution[];
  databases: readonly DatabaseSolution[];
  workflows: readonly WorkflowSolution[];
  integrations: readonly IntegrationSolution[];
  runtime: readonly RuntimeSolution[];
  deployment: readonly DeploymentSolution[];
  security: readonly SecuritySolution[];
  monitoring: readonly MonitoringSolution[];
  configuration: readonly ConfigurationSolution[];
  reporting: readonly ReportingSolution[];
  portals: readonly PortalSolution[];
  automation: readonly AutomationSolution[];
  authentication: readonly AuthenticationSolution[];
  authorization: readonly AuthorizationSolution[];
  notifications: readonly NotificationSolution[];
  search: readonly SearchSolution[];
  storage: readonly StorageSolution[];
  messaging: readonly MessagingSolution[];
  dependencyGraph: SolutionDependencyGraph;
  metadata: Readonly<Record<string, unknown>>;
  lineage: SolutionLineage;
  provenance: SolutionProvenance;
  confidence: SolutionConfidence;
}

export interface SolutionCompilationContext {
  compilerVersion: string;
  pipelineVersion: string;
  compiledAt: string;
  sourceBlueprintHash: string;
  sourceObjectCount: number;
  sourceIds: readonly string[];
  deterministicRunId: string;
}

export interface SolutionCompilationMetrics {
  applicationsProjected: number;
  modulesProjected: number;
  servicesProjected: number;
  apisProjected: number;
  databasesProjected: number;
  workflowsProjected: number;
  integrationsProjected: number;
  runtimeProjected: number;
  deploymentProjected: number;
  diagnosticsCount: number;
  validationErrorCount: number;
  dependencyNodeCount: number;
  dependencyEdgeCount: number;
  executionTimeMs: number;
}

export interface SolutionValidationSummary {
  passed: boolean;
  blockingErrorCount: number;
  warningCount: number;
}

export interface SolutionIR {
  schemaVersion: "1.0.0";
  enterpriseSolution: EnterpriseSolution;
  compilationContext: SolutionCompilationContext;
  diagnostics: readonly SolutionDiagnostic[];
  metrics: SolutionCompilationMetrics;
  validation: SolutionValidationSummary;
  deterministicHash: string;
  deterministicSerialization: string;
  compiledFromBlueprintHash: string;
  generatedAt: string;
}

export interface SolutionCompilationResult {
  success: boolean;
  solutionIR: SolutionIR;
  diagnostics: readonly SolutionDiagnostic[];
  metrics: SolutionCompilationMetrics;
  validation: SolutionValidationSummary;
  hash: string;
  compilationMetadata: SolutionCompilationContext;
}

export interface SolutionCompilerOptions {
  compilerVersion?: string;
  pipelineVersion?: string;
  compiledAt?: string;
}

export type SolutionInput = EnterpriseBlueprintIR;
