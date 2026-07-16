import type {
  BusinessGenomeIR,
  GenomeConflict,
  GenomeConfidence,
  GenomeLineage,
  GenomeProvenance,
  GenomeTemporalValidity,
  GenomeVersion,
} from "../business-genome/BusinessGenomeIR";

export type BlueprintDiagnosticSeverity = "info" | "warning" | "error";

export interface BlueprintDiagnostic {
  code: string;
  severity: BlueprintDiagnosticSeverity;
  message: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface BlueprintIdentity {
  id: string;
  kind: string;
  objectType: string;
  enterpriseScope: string;
  domainScope: string;
  moduleScope: string;
  parentRelationships: readonly string[];
  temporalScope: string;
  lineageSignature: string;
  versionSemantics: string;
}

export type BlueprintVersion = GenomeVersion;
export type BlueprintLineage = GenomeLineage;
export type BlueprintProvenance = GenomeProvenance;
export type BlueprintConfidence = GenomeConfidence;
export type BlueprintConflict = GenomeConflict;
export type BlueprintTemporalValidity = GenomeTemporalValidity;

export interface BlueprintObjectBase {
  identity: BlueprintIdentity;
  semanticType: string;
  canonicalName: string;
  canonicalContent: string;
  version: BlueprintVersion;
  provenance: BlueprintProvenance;
  lineage: BlueprintLineage;
  confidence: BlueprintConfidence;
  temporalValidity: BlueprintTemporalValidity;
  conflicts: readonly BlueprintConflict[];
  businessGenomeReferences: readonly string[];
  knowledgeReferences: readonly string[];
  evidenceReferences: readonly string[];
  compilerStage: "stage-5-blueprint-compiler";
  compilerVersion: string;
  validationStatus: "valid" | "warning" | "invalid";
  diagnosticReferences: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
}

export interface EnterpriseDefinition extends BlueprintObjectBase {
  enterpriseType: string;
  domainIds: readonly string[];
}

export interface DomainDefinition extends BlueprintObjectBase {
  parentEnterpriseId: string;
  boundedContextIds: readonly string[];
}

export interface BoundedContextDefinition extends BlueprintObjectBase {
  parentDomainId: string;
  moduleIds: readonly string[];
}

export interface ModuleDefinition extends BlueprintObjectBase {
  parentBoundedContextId: string;
  applicationIds: readonly string[];
}

export interface ApplicationDefinition extends BlueprintObjectBase {
  parentModuleId: string;
  serviceIds: readonly string[];
}

export interface ServiceDefinition extends BlueprintObjectBase {
  parentApplicationId: string;
  apiIds: readonly string[];
  repositoryIds: readonly string[];
}

export interface ApiDefinition extends BlueprintObjectBase {
  parentServiceId: string;
  commandIds: readonly string[];
  queryIds: readonly string[];
  eventIds: readonly string[];
}

export interface DatabaseDefinition extends BlueprintObjectBase {
  parentModuleId: string;
  schemaIds: readonly string[];
}

export interface SchemaDefinition extends BlueprintObjectBase {
  parentDatabaseId: string;
  aggregateIds: readonly string[];
}

export interface AggregateDefinition extends BlueprintObjectBase {
  parentSchemaId: string;
  entityIds: readonly string[];
  valueObjectIds: readonly string[];
}

export interface EntityDefinition extends BlueprintObjectBase {
  parentAggregateId: string;
  repositoryIds: readonly string[];
}

export interface ValueObjectDefinition extends BlueprintObjectBase {
  parentAggregateId: string;
}

export interface RepositoryDefinition extends BlueprintObjectBase {
  parentServiceId: string;
  entityIds: readonly string[];
}

export interface CommandDefinition extends BlueprintObjectBase {
  parentApiId: string;
  targetEntityIds: readonly string[];
}

export interface QueryDefinition extends BlueprintObjectBase {
  parentApiId: string;
  targetEntityIds: readonly string[];
}

export interface EventDefinition extends BlueprintObjectBase {
  parentApiId: string;
  workflowIds: readonly string[];
}

export interface WorkflowDefinition extends BlueprintObjectBase {
  parentDomainId: string;
  eventIds: readonly string[];
  serviceIds: readonly string[];
}

export interface IntegrationDefinition extends BlueprintObjectBase {
  sourceServiceId: string;
  targetServiceId: string;
  integrationType: string;
}

export interface PermissionDefinition extends BlueprintObjectBase {
  roleIds: readonly string[];
  policyIds: readonly string[];
}

export interface RoleDefinition extends BlueprintObjectBase {
  permissionIds: readonly string[];
}

export interface PolicyDefinition extends BlueprintObjectBase {
  permissionIds: readonly string[];
}

export interface RuntimeDefinition extends BlueprintObjectBase {
  environmentIds: readonly string[];
  dependencyNodeIds: readonly string[];
}

export interface InfrastructureDefinition extends BlueprintObjectBase {
  networkIds: readonly string[];
  storageIds: readonly string[];
  securityIds: readonly string[];
}

export interface DeploymentDefinition extends BlueprintObjectBase {
  environmentIds: readonly string[];
  runtimeIds: readonly string[];
}

export interface EnvironmentDefinition extends BlueprintObjectBase {
  configurationIds: readonly string[];
  secretReferenceIds: readonly string[];
}

export interface ConfigurationDefinition extends BlueprintObjectBase {
  environmentId: string;
}

export interface SecretReferenceDefinition extends BlueprintObjectBase {
  environmentId: string;
}

export interface MonitoringDefinition extends BlueprintObjectBase {
  runtimeId: string;
}

export interface SchedulingDefinition extends BlueprintObjectBase {
  runtimeId: string;
}

export interface MessagingDefinition extends BlueprintObjectBase {
  runtimeId: string;
}

export interface StorageDefinition extends BlueprintObjectBase {
  infrastructureId: string;
}

export interface NetworkDefinition extends BlueprintObjectBase {
  infrastructureId: string;
}

export interface SecurityDefinition extends BlueprintObjectBase {
  infrastructureId: string;
}

export interface BlueprintDependencyNode {
  id: string;
  type: string;
  ownerId: string;
  domainId: string;
}

export interface BlueprintDependencyEdge {
  from: string;
  to: string;
  relation: string;
}

export interface BlueprintDependencyGraph {
  nodes: readonly BlueprintDependencyNode[];
  edges: readonly BlueprintDependencyEdge[];
  hasCycle: boolean;
  cyclePaths: readonly string[];
  invalidDependencies: readonly string[];
  missingOwnership: readonly string[];
  crossDomainViolations: readonly string[];
  orphanModules: readonly string[];
  duplicateServices: readonly string[];
}

export interface EnterpriseBlueprint {
  version: string;
  generatedAt: string;
  enterprise: EnterpriseDefinition;
  domains: readonly DomainDefinition[];
  boundedContexts: readonly BoundedContextDefinition[];
  modules: readonly ModuleDefinition[];
  applications: readonly ApplicationDefinition[];
  services: readonly ServiceDefinition[];
  apis: readonly ApiDefinition[];
  databases: readonly DatabaseDefinition[];
  schemas: readonly SchemaDefinition[];
  aggregates: readonly AggregateDefinition[];
  entities: readonly EntityDefinition[];
  valueObjects: readonly ValueObjectDefinition[];
  repositories: readonly RepositoryDefinition[];
  commands: readonly CommandDefinition[];
  queries: readonly QueryDefinition[];
  events: readonly EventDefinition[];
  workflows: readonly WorkflowDefinition[];
  integrations: readonly IntegrationDefinition[];
  permissions: readonly PermissionDefinition[];
  roles: readonly RoleDefinition[];
  policies: readonly PolicyDefinition[];
  runtime: readonly RuntimeDefinition[];
  infrastructure: readonly InfrastructureDefinition[];
  deployments: readonly DeploymentDefinition[];
  environments: readonly EnvironmentDefinition[];
  configurations: readonly ConfigurationDefinition[];
  secretReferences: readonly SecretReferenceDefinition[];
  monitoring: readonly MonitoringDefinition[];
  scheduling: readonly SchedulingDefinition[];
  messaging: readonly MessagingDefinition[];
  storage: readonly StorageDefinition[];
  networks: readonly NetworkDefinition[];
  security: readonly SecurityDefinition[];
  dependencyGraph: BlueprintDependencyGraph;
}

export interface BlueprintCompilationContext {
  compilerVersion: string;
  pipelineVersion: string;
  compiledAt: string;
  sourceBusinessGenomeHash: string;
  sourceObjectCount: number;
  sourceTypes: readonly string[];
  sourceIds: readonly string[];
  deterministicRunId: string;
}

export interface BlueprintCompilationMetrics {
  domainsGenerated: number;
  boundedContextsGenerated: number;
  modulesGenerated: number;
  applicationsGenerated: number;
  servicesGenerated: number;
  apisGenerated: number;
  databasesGenerated: number;
  schemasGenerated: number;
  aggregatesGenerated: number;
  entitiesProjected: number;
  workflowsGenerated: number;
  eventsProjected: number;
  integrationsGenerated: number;
  runtimeDefined: number;
  deploymentsDefined: number;
  validationErrors: number;
  diagnosticsCount: number;
  dependencyNodeCount: number;
  dependencyEdgeCount: number;
  executionTimeMs: number;
}

export interface EnterpriseBlueprintIR {
  schemaVersion: "1.0.0";
  enterpriseBlueprint: EnterpriseBlueprint;
  compilationContext: BlueprintCompilationContext;
  diagnostics: readonly BlueprintDiagnostic[];
  metrics: BlueprintCompilationMetrics;
  deterministicHash: string;
  deterministicSerialization: string;
  compiledFromBusinessGenomeHash: string;
  generatedAt: string;
}

export interface BlueprintCompilationResult {
  success: boolean;
  enterpriseBlueprintIR: EnterpriseBlueprintIR;
  diagnostics: readonly BlueprintDiagnostic[];
  metrics: BlueprintCompilationMetrics;
}

export interface BlueprintCompilerOptions {
  compilerVersion?: string;
  pipelineVersion?: string;
  compiledAt?: string;
}

export type BlueprintInput = BusinessGenomeIR;
