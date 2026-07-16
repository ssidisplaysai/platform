import type {
  RuntimeAgentBinding,
  RuntimeApi,
  RuntimeApplication,
  RuntimeAuthenticationBinding,
  RuntimeAuthorizationBinding,
  RuntimeCompilationContext,
  RuntimeCompilationMetrics,
  RuntimeCompilationResult,
  RuntimeCompilerOptions,
  RuntimeConfigurationBinding,
  RuntimeDatabaseBinding,
  RuntimeDependencyBinding,
  RuntimeDeploymentTarget,
  RuntimeDiagnostic,
  RuntimeEnvironment,
  RuntimeEventBinding,
  RuntimeExecutionEdge,
  RuntimeExecutionGraph,
  RuntimeExecutionNode,
  RuntimeHealthCheck,
  RuntimeInput,
  RuntimeIntegrationBinding,
  RuntimeLoggingBinding,
  RuntimeMessagingBinding,
  RuntimeModule,
  RuntimeMonitoringBinding,
  RuntimeNotificationBinding,
  RuntimePluginBinding,
  RuntimeProviderBinding,
  RuntimeRecoveryPlan,
  RuntimeSchedulerBinding,
  RuntimeSearchBinding,
  RuntimeSecretReference,
  RuntimeService,
  RuntimeShutdownPlan,
  RuntimeStorageBinding,
  RuntimeTelemetryBinding,
  RuntimeWorkflowBinding,
  EnterpriseRuntime,
  EnterpriseRuntimeIR,
} from "./EnterpriseRuntimeIR";
import { toRuntimeConflict } from "./EnterpriseRuntimeIR";
import { RuntimeHasher } from "./RuntimeHasher";
import { RuntimeIdentityFactory } from "./RuntimeIdentity";
import { RuntimeValidator } from "./RuntimeValidator";

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((entry) => Boolean(entry)))].sort((a, b) => a.localeCompare(b));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function edgeId(from: string, to: string, edgeType: RuntimeExecutionEdge["edgeType"]): string {
  return `${edgeType}:${from}->${to}`;
}

function detectCycles(nodes: readonly RuntimeExecutionNode[], edges: readonly RuntimeExecutionEdge[]): string[] {
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    outgoing.set(node.nodeId, []);
  }
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to].sort((a, b) => a.localeCompare(b)));
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const cycles = new Set<string>();

  const walk = (nodeId: string): void => {
    visiting.add(nodeId);
    path.push(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      if (visiting.has(next)) {
        const index = path.indexOf(next);
        if (index >= 0) {
          cycles.add(path.slice(index).concat(next).join(" -> "));
        }
        continue;
      }
      if (!visited.has(next)) {
        walk(next);
      }
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of [...nodes].map((entry) => entry.nodeId).sort((a, b) => a.localeCompare(b))) {
    if (!visited.has(node)) {
      walk(node);
    }
  }

  return [...cycles].sort((a, b) => a.localeCompare(b));
}

const ACTIVATION_PHASES = [
  "Configuration",
  "Secrets Resolution Preparation",
  "Provider Registration",
  "Infrastructure Binding",
  "Storage Binding",
  "Messaging Binding",
  "Authentication Binding",
  "Authorization Binding",
  "Service Registration",
  "API Registration",
  "Workflow Registration",
  "Scheduler Registration",
  "Event Registration",
  "Agent Registration",
  "Monitoring Registration",
  "Health Verification",
  "Runtime Ready",
] as const;

export class RuntimeCompiler {
  private readonly hasher = new RuntimeHasher();
  private readonly validator = new RuntimeValidator();

  compile(input: RuntimeInput, options: RuntimeCompilerOptions = {}): EnterpriseRuntimeIR {
    return this.compileWithResult(input, options).enterpriseRuntimeIR;
  }

  compileWithResult(input: RuntimeInput, options: RuntimeCompilerOptions = {}): RuntimeCompilationResult {
    const compilerVersion = options.compilerVersion ?? "1.0.0";
    const pipelineVersion = options.pipelineVersion ?? "1.0.0";
    const passVersion = options.passVersion ?? "1.0.0";
    const compiledAt = options.compiledAt ?? input.generatedAt;

    const enterpriseSolution = input.enterpriseSolution;
    const diagnostics: RuntimeDiagnostic[] = [];

    const rootIdentity = RuntimeIdentityFactory.generate({
      kind: "enterprise-runtime",
      objectType: "enterprise-runtime",
      sourceSolutionIdentity: enterpriseSolution.solutionId,
      canonicalSemanticPayload: {
        enterpriseId: enterpriseSolution.enterpriseId,
        solutionId: enterpriseSolution.solutionId,
      },
      lineageSignature: enterpriseSolution.lineage.sourceKnowledgeId,
      versionSemantics: enterpriseSolution.version,
    });

    const runtimeStatus: EnterpriseRuntime["status"] = "planned";

    const modules: RuntimeModule[] = enterpriseSolution.modules
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-module",
          objectType: "module",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { module: entry.name, ownerId: entry.ownerId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        moduleId: entry.identity.id,
        name: entry.name,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const moduleRuntimeBySolutionId = new Map(modules.map((entry) => [entry.moduleId, entry.runtimeId]));

    const applications: RuntimeApplication[] = enterpriseSolution.applications
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-application",
          objectType: "application",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { application: entry.name, moduleId: entry.moduleId },
          parentIdentity: moduleRuntimeBySolutionId.get(entry.moduleId),
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        applicationId: entry.identity.id,
        moduleId: moduleRuntimeBySolutionId.get(entry.moduleId) ?? entry.moduleId,
        name: entry.name,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const appRuntimeBySolutionId = new Map(applications.map((entry) => [entry.applicationId, entry.runtimeId]));

    const services: RuntimeService[] = enterpriseSolution.services
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-service",
          objectType: "service",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { service: entry.name, applicationId: entry.applicationId },
          parentIdentity: appRuntimeBySolutionId.get(entry.applicationId),
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        serviceId: entry.identity.id,
        applicationId: appRuntimeBySolutionId.get(entry.applicationId) ?? entry.applicationId,
        name: entry.name,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const serviceRuntimeBySolutionId = new Map(services.map((entry) => [entry.serviceId, entry.runtimeId]));

    const apis: RuntimeApi[] = enterpriseSolution.apis
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-api",
          objectType: "api",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { api: entry.name, serviceId: entry.serviceId },
          parentIdentity: serviceRuntimeBySolutionId.get(entry.serviceId),
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        apiId: entry.identity.id,
        serviceId: serviceRuntimeBySolutionId.get(entry.serviceId) ?? entry.serviceId,
        name: entry.name,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const apiRuntimeBySolutionId = new Map(apis.map((entry) => [entry.apiId, entry.runtimeId]));

    const databaseBindings: RuntimeDatabaseBinding[] = enterpriseSolution.databases
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-database-binding",
          objectType: "database-binding",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { database: entry.name, moduleId: entry.moduleId },
          parentIdentity: moduleRuntimeBySolutionId.get(entry.moduleId),
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `db-bind-${entry.identity.id}`,
        moduleId: moduleRuntimeBySolutionId.get(entry.moduleId) ?? entry.moduleId,
        contract: `database/${entry.name.toLowerCase().replace(/\s+/g, "-")}`,
        name: `${entry.name} Database Binding`,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const runtimeRootFromSolution = enterpriseSolution.runtime[0];
    const runtimeRootRef = runtimeRootFromSolution ? runtimeRootFromSolution.identity.id : rootIdentity.id;

    const storageBindings: RuntimeStorageBinding[] = enterpriseSolution.storage
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-storage-binding",
          objectType: "storage-binding",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { storage: entry.name, runtimeId: runtimeRootRef },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `storage-bind-${entry.identity.id}`,
        providerId: runtimeRootRef,
        name: `${entry.name} Storage Binding`,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const messagingBindings: RuntimeMessagingBinding[] = enterpriseSolution.messaging
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-messaging-binding",
          objectType: "messaging-binding",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { messaging: entry.name, runtimeId: entry.runtimeId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `msg-bind-${entry.identity.id}`,
        providerId: entry.runtimeId,
        name: `${entry.name} Messaging Binding`,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const searchBindings: RuntimeSearchBinding[] = enterpriseSolution.search
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-search-binding",
          objectType: "search-binding",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { search: entry.name, apiIds: entry.apiIds },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `search-bind-${entry.identity.id}`,
        apiIds: entry.apiIds.map((apiId) => apiRuntimeBySolutionId.get(apiId) ?? apiId).sort((a, b) => a.localeCompare(b)),
        name: `${entry.name} Search Binding`,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const workflowBindings: RuntimeWorkflowBinding[] = enterpriseSolution.workflows
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-workflow-binding",
          objectType: "workflow-binding",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { workflow: entry.name, serviceIds: entry.serviceIds },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `wf-bind-${entry.identity.id}`,
        workflowId: entry.identity.id,
        serviceIds: entry.serviceIds.map((serviceId) => serviceRuntimeBySolutionId.get(serviceId) ?? serviceId).sort((a, b) => a.localeCompare(b)),
        name: `${entry.name} Workflow Binding`,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const integrationBindings: RuntimeIntegrationBinding[] = enterpriseSolution.integrations
      .map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-integration-binding",
          objectType: "integration-binding",
          sourceSolutionIdentity: entry.identity.id,
          canonicalSemanticPayload: { integration: entry.name, source: entry.sourceServiceId, target: entry.targetServiceId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `int-bind-${entry.identity.id}`,
        sourceServiceId: serviceRuntimeBySolutionId.get(entry.sourceServiceId) ?? entry.sourceServiceId,
        targetServiceId: serviceRuntimeBySolutionId.get(entry.targetServiceId) ?? entry.targetServiceId,
        name: `${entry.name} Integration Binding`,
        status: runtimeStatus,
        sourceSolutionObjectId: entry.identity.id,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
        metadata: entry.metadata,
      }))
      .sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const schedulerBindings: RuntimeSchedulerBinding[] = [
      {
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-scheduler-binding",
          objectType: "scheduler-binding",
          sourceSolutionIdentity: runtimeRootRef,
          canonicalSemanticPayload: { scheduler: "default", runtime: runtimeRootRef },
          parentIdentity: rootIdentity.id,
          lineageSignature: enterpriseSolution.lineage.sourceKnowledgeId,
          versionSemantics: enterpriseSolution.version,
        }).id,
        bindingId: `sched-bind-${runtimeRootRef}`,
        runtimeIdRef: runtimeRootRef,
        name: "Default Scheduler Binding",
        status: runtimeStatus,
        sourceSolutionObjectId: runtimeRootRef,
        version: enterpriseSolution.modules[0]?.version ?? enterpriseSolution.applications[0]?.version ?? enterpriseSolution.services[0]?.version ?? {
          semver: enterpriseSolution.version,
          revision: 1,
          compiledAt,
          supersedes: null,
          supersededBy: null,
        },
        lineage: enterpriseSolution.lineage,
        provenance: enterpriseSolution.provenance,
        confidence: enterpriseSolution.confidence,
        temporalValidity: enterpriseSolution.modules[0]?.temporalValidity ?? {
          validFrom: compiledAt,
          validTo: null,
          observedAt: compiledAt,
          compiledAt,
          supersedes: null,
          supersededBy: null,
        },
        diagnostics: [],
        metadata: {},
      },
    ];

    const eventBindings: RuntimeEventBinding[] = [
      {
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-event-binding",
          objectType: "event-binding",
          sourceSolutionIdentity: runtimeRootRef,
          canonicalSemanticPayload: {
            publisher: services[0]?.runtimeId ?? "",
            subscribers: services.slice(1).map((entry) => entry.runtimeId),
          },
          parentIdentity: rootIdentity.id,
          lineageSignature: enterpriseSolution.lineage.sourceKnowledgeId,
          versionSemantics: enterpriseSolution.version,
        }).id,
        bindingId: `event-bind-${runtimeRootRef}`,
        publisherId: services[0]?.runtimeId ?? rootIdentity.id,
        subscriberIds: services.slice(1).map((entry) => entry.runtimeId).sort((a, b) => a.localeCompare(b)),
        name: "Default Event Binding",
        status: runtimeStatus,
        sourceSolutionObjectId: runtimeRootRef,
        version: schedulerBindings[0].version,
        lineage: enterpriseSolution.lineage,
        provenance: enterpriseSolution.provenance,
        confidence: enterpriseSolution.confidence,
        temporalValidity: schedulerBindings[0].temporalValidity,
        diagnostics: [],
        metadata: {},
      },
    ];

    const notificationBindings: RuntimeNotificationBinding[] = enterpriseSolution.notifications.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-notification-binding",
        objectType: "notification-binding",
        sourceSolutionIdentity: entry.identity.id,
        canonicalSemanticPayload: { notification: entry.name, channel: entry.messagingId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `not-bind-${entry.identity.id}`,
      channelProviderId: entry.messagingId,
      name: `${entry.name} Notification Binding`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.identity.id,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
      metadata: entry.metadata,
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const authenticationBindings: RuntimeAuthenticationBinding[] = enterpriseSolution.authentication.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-auth-binding",
        objectType: "authentication-binding",
        sourceSolutionIdentity: entry.identity.id,
        canonicalSemanticPayload: { auth: entry.name, runtimeId: entry.runtimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `authn-bind-${entry.identity.id}`,
      providerId: entry.runtimeId,
      name: `${entry.name} Authentication Binding`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.identity.id,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
      metadata: entry.metadata,
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const authorizationBindings: RuntimeAuthorizationBinding[] = enterpriseSolution.authorization.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-authz-binding",
        objectType: "authorization-binding",
        sourceSolutionIdentity: entry.identity.id,
        canonicalSemanticPayload: { authz: entry.name, runtimeId: entry.runtimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `authz-bind-${entry.identity.id}`,
      policyProviderId: entry.runtimeId,
      name: `${entry.name} Authorization Binding`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.identity.id,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
      metadata: entry.metadata,
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const configurationBindings: RuntimeConfigurationBinding[] = enterpriseSolution.configuration.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-config-binding",
        objectType: "configuration-binding",
        sourceSolutionIdentity: entry.identity.id,
        canonicalSemanticPayload: { config: entry.name, runtimeId: entry.runtimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `cfg-bind-${entry.identity.id}`,
      runtimeIdRef: entry.runtimeId,
      configurationReferences: [entry.identity.id],
      name: `${entry.name} Configuration Binding`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.identity.id,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
      metadata: entry.metadata,
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const defaultTemporal = {
      validFrom: compiledAt,
      validTo: null,
      observedAt: compiledAt,
      compiledAt,
      supersedes: null,
      supersededBy: null,
    };

    const environments: RuntimeEnvironment[] = [
      {
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-environment",
          objectType: "environment",
          sourceSolutionIdentity: enterpriseSolution.solutionId,
          canonicalSemanticPayload: { environment: "default" },
          parentIdentity: rootIdentity.id,
          lineageSignature: enterpriseSolution.lineage.sourceKnowledgeId,
          versionSemantics: enterpriseSolution.version,
        }).id,
        environmentId: "env-default",
        name: "default",
        status: runtimeStatus,
        sourceSolutionObjectId: enterpriseSolution.solutionId,
        version: schedulerBindings[0].version,
        lineage: enterpriseSolution.lineage,
        provenance: enterpriseSolution.provenance,
        confidence: enterpriseSolution.confidence,
        temporalValidity: defaultTemporal,
        diagnostics: [],
        metadata: {},
      },
    ];

    const deploymentTargets: RuntimeDeploymentTarget[] = enterpriseSolution.deployment.map((entry, index) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-deployment-target",
        objectType: "deployment-target",
        sourceSolutionIdentity: entry.identity.id,
        canonicalSemanticPayload: { deployment: entry.name, environment: environments[0].environmentId },
        parentIdentity: rootIdentity.id,
        environmentScope: environments[0].environmentId,
        deploymentScope: entry.identity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      deploymentTargetId: `deploy-target-${index + 1}`,
      environmentId: environments[0].environmentId,
      name: entry.name,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.identity.id,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
      metadata: entry.metadata,
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const secretReferences: RuntimeSecretReference[] = configurationBindings.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-secret-reference",
        objectType: "secret-reference",
        sourceSolutionIdentity: entry.sourceSolutionObjectId,
        canonicalSemanticPayload: { secretRef: entry.bindingId, environmentId: environments[0].environmentId },
        parentIdentity: rootIdentity.id,
        environmentScope: environments[0].environmentId,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      secretReferenceId: `secret-ref-${entry.bindingId}`,
      environmentId: environments[0].environmentId,
      resolutionPolicy: "deferred" as const,
      name: `${entry.name} Secret Reference`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.sourceSolutionObjectId,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [],
      metadata: { doesNotResolve: true },
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const healthChecks: RuntimeHealthCheck[] = services.map((service) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-health-check",
        objectType: "health-check",
        sourceSolutionIdentity: service.sourceSolutionObjectId,
        canonicalSemanticPayload: { targetService: service.runtimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: service.lineage.sourceKnowledgeId,
        versionSemantics: service.version.semver,
      }).id,
      healthCheckId: `health-${service.runtimeId}`,
      targetServiceId: service.runtimeId,
      required: true,
      name: `${service.name} Health`,
      status: runtimeStatus,
      sourceSolutionObjectId: service.sourceSolutionObjectId,
      version: service.version,
      lineage: service.lineage,
      provenance: service.provenance,
      confidence: service.confidence,
      temporalValidity: service.temporalValidity,
      diagnostics: [],
      metadata: {},
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const monitoringBindings: RuntimeMonitoringBinding[] = enterpriseSolution.monitoring.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-monitoring-binding",
        objectType: "monitoring-binding",
        sourceSolutionIdentity: entry.identity.id,
        canonicalSemanticPayload: { monitoring: entry.name, runtimeId: entry.runtimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `mon-bind-${entry.identity.id}`,
      targetRuntimeId: entry.runtimeId,
      name: `${entry.name} Monitoring Binding`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.identity.id,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [...entry.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
      metadata: entry.metadata,
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const telemetryBindings: RuntimeTelemetryBinding[] = monitoringBindings.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-telemetry-binding",
        objectType: "telemetry-binding",
        sourceSolutionIdentity: entry.sourceSolutionObjectId,
        canonicalSemanticPayload: { telemetry: entry.bindingId, runtimeId: entry.targetRuntimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `tel-bind-${entry.bindingId}`,
      targetRuntimeId: entry.targetRuntimeId,
      name: `${entry.name} Telemetry`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.sourceSolutionObjectId,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [],
      metadata: {},
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const loggingBindings: RuntimeLoggingBinding[] = monitoringBindings.map((entry) => ({
      runtimeId: RuntimeIdentityFactory.generate({
        kind: "runtime-logging-binding",
        objectType: "logging-binding",
        sourceSolutionIdentity: entry.sourceSolutionObjectId,
        canonicalSemanticPayload: { logging: entry.bindingId, runtimeId: entry.targetRuntimeId },
        parentIdentity: rootIdentity.id,
        lineageSignature: entry.lineage.sourceKnowledgeId,
        versionSemantics: entry.version.semver,
      }).id,
      bindingId: `log-bind-${entry.bindingId}`,
      targetRuntimeId: entry.targetRuntimeId,
      name: `${entry.name} Logging`,
      status: runtimeStatus,
      sourceSolutionObjectId: entry.sourceSolutionObjectId,
      version: entry.version,
      lineage: entry.lineage,
      provenance: entry.provenance,
      confidence: entry.confidence,
      temporalValidity: entry.temporalValidity,
      diagnostics: [],
      metadata: {},
    })).sort((a, b) => a.runtimeId.localeCompare(b.runtimeId));

    const providerBindings: RuntimeProviderBinding[] = [
      ...databaseBindings.map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-provider-binding",
          objectType: "provider-binding",
          sourceSolutionIdentity: entry.sourceSolutionObjectId,
          canonicalSemanticPayload: { contract: entry.contract, provider: entry.moduleId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `provider-${entry.bindingId}`,
        providerId: entry.moduleId,
        contract: entry.contract,
        scope: "singleton" as const,
        name: `${entry.name} Provider`,
        status: entry.status,
        sourceSolutionObjectId: entry.sourceSolutionObjectId,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: entry.diagnostics,
        metadata: entry.metadata,
      })),
      ...authenticationBindings.map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-provider-binding",
          objectType: "provider-binding",
          sourceSolutionIdentity: entry.sourceSolutionObjectId,
          canonicalSemanticPayload: { contract: "security/authentication", provider: entry.providerId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `provider-${entry.bindingId}`,
        providerId: entry.providerId,
        contract: "security/authentication",
        scope: "singleton" as const,
        name: `${entry.name} Provider`,
        status: entry.status,
        sourceSolutionObjectId: entry.sourceSolutionObjectId,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: entry.diagnostics,
        metadata: entry.metadata,
      })),
      ...authorizationBindings.map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-provider-binding",
          objectType: "provider-binding",
          sourceSolutionIdentity: entry.sourceSolutionObjectId,
          canonicalSemanticPayload: { contract: "security/authorization", provider: entry.policyProviderId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `provider-${entry.bindingId}`,
        providerId: entry.policyProviderId,
        contract: "security/authorization",
        scope: "singleton" as const,
        name: `${entry.name} Provider`,
        status: entry.status,
        sourceSolutionObjectId: entry.sourceSolutionObjectId,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: entry.diagnostics,
        metadata: entry.metadata,
      })),
      ...services.map((entry) => ({
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-provider-binding",
          objectType: "provider-binding",
          sourceSolutionIdentity: entry.sourceSolutionObjectId,
          canonicalSemanticPayload: { contract: "service/runtime-api", provider: entry.runtimeId },
          parentIdentity: rootIdentity.id,
          lineageSignature: entry.lineage.sourceKnowledgeId,
          versionSemantics: entry.version.semver,
        }).id,
        bindingId: `provider-service-${entry.runtimeId}`,
        providerId: entry.runtimeId,
        contract: "service/runtime-api",
        scope: "scoped" as const,
        name: `${entry.name} Service Provider`,
        status: entry.status,
        sourceSolutionObjectId: entry.sourceSolutionObjectId,
        version: entry.version,
        lineage: entry.lineage,
        provenance: entry.provenance,
        confidence: entry.confidence,
        temporalValidity: entry.temporalValidity,
        diagnostics: entry.diagnostics,
        metadata: entry.metadata,
      })),
    ].sort((a, b) => a.bindingId.localeCompare(b.bindingId));

    const dependencyBindings: RuntimeDependencyBinding[] = [
      ...services.map((service) => ({
        runtimeId: service.runtimeId,
        bindingId: `dep-${service.runtimeId}`,
        consumerId: service.runtimeId,
        providerId: databaseBindings[0]?.runtimeId ?? providerBindings[0]?.providerId ?? rootIdentity.id,
        contract: databaseBindings[0]?.contract ?? "database/default",
        scope: "scoped" as const,
        lifecycle: "scoped" as const,
        required: true,
        configurationReferences: configurationBindings.map((entry) => entry.bindingId),
        dependencyReferences: [],
        name: `${service.name} Dependency`,
        status: runtimeStatus,
        sourceSolutionObjectId: service.sourceSolutionObjectId,
        version: service.version,
        lineage: service.lineage,
        provenance: service.provenance,
        confidence: service.confidence,
        temporalValidity: service.temporalValidity,
        diagnostics: service.diagnostics,
        metadata: {},
      })),
      ...apis.map((api) => ({
        runtimeId: api.runtimeId,
        bindingId: `dep-${api.runtimeId}`,
        consumerId: api.runtimeId,
        providerId: serviceRuntimeBySolutionId.get(api.serviceId) ?? api.serviceId,
        contract: "service/runtime-api",
        scope: "singleton" as const,
        lifecycle: "singleton" as const,
        required: true,
        configurationReferences: configurationBindings.map((entry) => entry.bindingId),
        dependencyReferences: [api.serviceId],
        name: `${api.name} Dependency`,
        status: runtimeStatus,
        sourceSolutionObjectId: api.sourceSolutionObjectId,
        version: api.version,
        lineage: api.lineage,
        provenance: api.provenance,
        confidence: api.confidence,
        temporalValidity: api.temporalValidity,
        diagnostics: api.diagnostics,
        metadata: {},
      })),
    ].sort((a, b) => a.bindingId.localeCompare(b.bindingId));

    const pluginBindings: RuntimePluginBinding[] = [
      {
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-plugin-binding",
          objectType: "plugin-binding",
          sourceSolutionIdentity: enterpriseSolution.solutionId,
          canonicalSemanticPayload: { plugin: "core-runtime-plugin" },
          parentIdentity: rootIdentity.id,
          lineageSignature: enterpriseSolution.lineage.sourceKnowledgeId,
          versionSemantics: enterpriseSolution.version,
        }).id,
        bindingId: "plugin-core-runtime",
        pluginId: "core-runtime-plugin",
        targetRuntimeId: rootIdentity.id,
        name: "Core Runtime Plugin",
        status: runtimeStatus,
        sourceSolutionObjectId: enterpriseSolution.solutionId,
        version: schedulerBindings[0].version,
        lineage: enterpriseSolution.lineage,
        provenance: enterpriseSolution.provenance,
        confidence: enterpriseSolution.confidence,
        temporalValidity: defaultTemporal,
        diagnostics: [],
        metadata: {},
      },
    ];

    const agentBindings: RuntimeAgentBinding[] = [
      {
        runtimeId: RuntimeIdentityFactory.generate({
          kind: "runtime-agent-binding",
          objectType: "agent-binding",
          sourceSolutionIdentity: enterpriseSolution.solutionId,
          canonicalSemanticPayload: { agent: "runtime-observer-agent" },
          parentIdentity: rootIdentity.id,
          lineageSignature: enterpriseSolution.lineage.sourceKnowledgeId,
          versionSemantics: enterpriseSolution.version,
        }).id,
        bindingId: "agent-runtime-observer",
        agentId: "runtime-observer-agent",
        targetRuntimeId: rootIdentity.id,
        name: "Runtime Observer Agent",
        status: runtimeStatus,
        sourceSolutionObjectId: enterpriseSolution.solutionId,
        version: schedulerBindings[0].version,
        lineage: enterpriseSolution.lineage,
        provenance: enterpriseSolution.provenance,
        confidence: enterpriseSolution.confidence,
        temporalValidity: defaultTemporal,
        diagnostics: [],
        metadata: {
          executionAllowed: false,
        },
      },
    ];

    const phaseUnits = [
      {
        phase: "Configuration",
        unitIds: configurationBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Secrets Resolution Preparation",
        unitIds: secretReferences.map((entry) => entry.secretReferenceId),
      },
      {
        phase: "Provider Registration",
        unitIds: providerBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Infrastructure Binding",
        unitIds: deploymentTargets.map((entry) => entry.deploymentTargetId),
      },
      {
        phase: "Storage Binding",
        unitIds: storageBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Messaging Binding",
        unitIds: messagingBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Authentication Binding",
        unitIds: authenticationBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Authorization Binding",
        unitIds: authorizationBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Service Registration",
        unitIds: services.map((entry) => entry.runtimeId),
      },
      {
        phase: "API Registration",
        unitIds: apis.map((entry) => entry.runtimeId),
      },
      {
        phase: "Workflow Registration",
        unitIds: workflowBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Scheduler Registration",
        unitIds: schedulerBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Event Registration",
        unitIds: eventBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Agent Registration",
        unitIds: agentBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Monitoring Registration",
        unitIds: monitoringBindings.map((entry) => entry.bindingId),
      },
      {
        phase: "Health Verification",
        unitIds: healthChecks.map((entry) => entry.healthCheckId),
      },
      {
        phase: "Runtime Ready",
        unitIds: [rootIdentity.id],
      },
    ] as const;

    const activationPlan = {
      phases: ACTIVATION_PHASES.map((phaseName, index) => {
        const config = phaseUnits.find((entry) => entry.phase === phaseName);
        const units = (config?.unitIds ?? []).map((unitId) => ({
          unitId,
          objectType: phaseName.toLowerCase().replace(/\s+/g, "-"),
          requiredDependencies: uniqueSorted(dependencyBindings.map((entry) => entry.providerId).slice(0, 1)),
          optionalDependencies: uniqueSorted(dependencyBindings.map((entry) => entry.providerId).slice(1)),
          readinessGates: ["configuration-loaded"],
          healthGates: phaseName === "Health Verification" ? ["all-health-checks-pass"] : [],
          retryPolicyRef: "retry-default",
          rollbackHookRefs: ["rollback-default"],
          failureBoundary: `${phaseName.toLowerCase().replace(/\s+/g, "-" )}-boundary`,
          timeoutPolicyRef: "timeout-default",
        }));

        return {
          phase: phaseName,
          order: index + 1,
          serialExecution: phaseName !== "Provider Registration" && phaseName !== "Service Registration",
          parallelizableGroups: units.map((entry) => entry.unitId).sort((a, b) => a.localeCompare(b)),
          units: units.sort((a, b) => a.unitId.localeCompare(b.unitId)),
        };
      }),
    };

    const shutdownPlan: RuntimeShutdownPlan = {
      orderedSteps: [
        "drain-apis",
        "stop-workflows",
        "flush-messaging",
        "flush-logging",
        "detach-bindings",
        "mark-runtime-inactive",
      ],
    };

    const recoveryPlan: RuntimeRecoveryPlan = {
      orderedSteps: [
        "restore-configuration",
        "restore-provider-bindings",
        "rebuild-dependency-graph",
        "re-register-services",
        "replay-events",
        "run-health-verification",
      ],
    };

    const nodes: RuntimeExecutionNode[] = [
      ...services.map((entry) => ({
        nodeId: `node-${entry.runtimeId}`,
        runtimeObjectId: entry.runtimeId,
        objectType: "service",
        environmentId: environments[0]?.environmentId,
        deploymentTargetId: deploymentTargets[0]?.deploymentTargetId,
      })),
      ...apis.map((entry) => ({
        nodeId: `node-${entry.runtimeId}`,
        runtimeObjectId: entry.runtimeId,
        objectType: "api",
        environmentId: environments[0]?.environmentId,
        deploymentTargetId: deploymentTargets[0]?.deploymentTargetId,
      })),
      ...workflowBindings.map((entry) => ({
        nodeId: `node-${entry.runtimeId}`,
        runtimeObjectId: entry.runtimeId,
        objectType: "workflow",
        environmentId: environments[0]?.environmentId,
        deploymentTargetId: deploymentTargets[0]?.deploymentTargetId,
      })),
      ...providerBindings.map((entry) => ({
        nodeId: `node-${entry.runtimeId}`,
        runtimeObjectId: entry.runtimeId,
        objectType: "provider",
        environmentId: environments[0]?.environmentId,
        deploymentTargetId: deploymentTargets[0]?.deploymentTargetId,
      })),
    ].sort((a, b) => a.nodeId.localeCompare(b.nodeId));

    const nodeByObjectId = new Map(nodes.map((entry) => [entry.runtimeObjectId, entry.nodeId]));

    const edges: RuntimeExecutionEdge[] = [
      ...dependencyBindings
        .map((entry) => ({
          from: nodeByObjectId.get(entry.consumerId),
          to: nodeByObjectId.get(entry.providerId),
          edgeType: "requires" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "requires" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...apis
        .map((entry) => ({
          from: nodeByObjectId.get(entry.runtimeId),
          to: nodeByObjectId.get(entry.serviceId),
          edgeType: "binds_to" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "binds_to" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...integrationBindings
        .map((entry) => ({
          from: nodeByObjectId.get(entry.sourceServiceId),
          to: nodeByObjectId.get(entry.targetServiceId),
          edgeType: "invokes" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "invokes" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...monitoringBindings
        .map((entry) => ({
          from: nodeByObjectId.get(entry.runtimeId),
          to: nodeByObjectId.get(entry.targetRuntimeId),
          edgeType: "monitors" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "monitors" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...schedulerBindings
        .map((entry) => ({
          from: nodeByObjectId.get(entry.runtimeId),
          to: nodes[0]?.nodeId,
          edgeType: "schedules" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "schedules" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...eventBindings
        .flatMap((entry) => entry.subscriberIds.map((subscriberId) => ({
          from: nodeByObjectId.get(entry.publisherId),
          to: nodeByObjectId.get(subscriberId),
          edgeType: "publishes_to" as const,
        })))
        .filter((entry): entry is { from: string; to: string; edgeType: "publishes_to" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...healthChecks
        .map((entry) => ({
          from: nodeByObjectId.get(entry.runtimeId),
          to: nodeByObjectId.get(entry.targetServiceId),
          edgeType: "recovers_with" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "recovers_with" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...workflowBindings
        .flatMap((entry) => entry.serviceIds.map((serviceId) => ({
          from: nodeByObjectId.get(entry.runtimeId),
          to: nodeByObjectId.get(serviceId),
          edgeType: "invokes" as const,
        })))
        .filter((entry): entry is { from: string; to: string; edgeType: "invokes" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
      ...providerBindings
        .map((entry) => ({
          from: nodeByObjectId.get(services[0]?.runtimeId ?? ""),
          to: nodeByObjectId.get(entry.runtimeId),
          edgeType: "binds_to" as const,
        }))
        .filter((entry): entry is { from: string; to: string; edgeType: "binds_to" } => Boolean(entry.from) && Boolean(entry.to))
        .map((entry) => ({
          edgeId: edgeId(entry.from, entry.to, entry.edgeType),
          ...entry,
        })),
    ].sort((a, b) => a.edgeId.localeCompare(b.edgeId));

    const referencedNodeIds = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
    const orphanNodeIds = nodes.filter((node) => !referencedNodeIds.has(node.nodeId)).map((node) => node.nodeId);
    const cycles = detectCycles(nodes, edges);

    const executionGraph: RuntimeExecutionGraph = {
      nodes,
      edges,
      hasCycle: cycles.length > 0,
      orphanNodeIds: orphanNodeIds.sort((a, b) => a.localeCompare(b)),
      violations: [
        ...cycles.map((cycle) => `cycle:${cycle}`),
        ...orphanNodeIds.map((nodeId) => `orphan:${nodeId}`),
      ].sort((a, b) => a.localeCompare(b)),
    };

    const blockingConflicts = [
      ...enterpriseSolution.modules.flatMap((entry) => entry.conflicts),
      ...enterpriseSolution.services.flatMap((entry) => entry.conflicts),
      ...enterpriseSolution.apis.flatMap((entry) => entry.conflicts),
      ...enterpriseSolution.integrations.flatMap((entry) => entry.conflicts),
    ].filter((entry) => entry.blocking || entry.status === "blocking");

    if (blockingConflicts.length > 0) {
      for (const conflict of blockingConflicts) {
        diagnostics.push({
          code: "RUN-CFL-001",
          severity: "error",
          category: "validation",
          message: `Blocking runtime conflict: ${conflict.conflictType}`,
          sourceObjectId: conflict.id,
          cause: conflict.relatedIds.join(","),
          blocking: true,
        });
      }
    }

    const enterpriseRuntime: EnterpriseRuntime = {
      runtimeId: rootIdentity.id,
      solutionId: enterpriseSolution.solutionId,
      blueprintId: enterpriseSolution.modules[0]?.blueprintReferences[0] ?? "",
      businessGenomeId: enterpriseSolution.lineage.sourceKnowledgeId,
      enterpriseId: enterpriseSolution.enterpriseId,
      name: `${enterpriseSolution.name} Runtime`,
      version: "1.0.0",
      status: runtimeStatus,
      modules,
      applications,
      services,
      apis,
      databaseBindings,
      storageBindings,
      messagingBindings,
      searchBindings,
      workflowBindings,
      integrationBindings,
      schedulerBindings,
      eventBindings,
      notificationBindings,
      authenticationBindings,
      authorizationBindings,
      configurationBindings,
      secretReferences,
      environments,
      deploymentTargets,
      healthChecks,
      monitoringBindings,
      telemetryBindings,
      loggingBindings,
      dependencyBindings,
      providerBindings,
      pluginBindings,
      agentBindings,
      activationPlan,
      shutdownPlan,
      recoveryPlan,
      executionGraph,
      lineage: {
        ...enterpriseSolution.lineage,
        transformationPath: [...enterpriseSolution.lineage.transformationPath, "stage-7-runtime-compiler"],
      },
      provenance: {
        ...enterpriseSolution.provenance,
        compilerStage: "stage-7-runtime-compiler",
      },
      confidence: enterpriseSolution.confidence,
      temporalValidity: {
        validFrom: enterpriseSolution.modules[0]?.temporalValidity.validFrom ?? compiledAt,
        validTo: enterpriseSolution.modules[0]?.temporalValidity.validTo ?? null,
        observedAt: enterpriseSolution.modules[0]?.temporalValidity.observedAt ?? compiledAt,
        compiledAt,
        supersedes: enterpriseSolution.modules[0]?.temporalValidity.supersedes ?? null,
        supersededBy: enterpriseSolution.modules[0]?.temporalValidity.supersededBy ?? null,
      },
      diagnostics: [],
      validation: {
        passed: true,
        blockingErrorCount: 0,
        warningCount: 0,
        diagnosticsCount: 0,
      },
      metadata: {
        sourceSolutionHash: input.deterministicHash,
        sourceSolutionVersion: enterpriseSolution.version,
        conflicts: uniqueSorted(
          [
            ...enterpriseSolution.modules.flatMap((entry) => entry.conflicts.map((conflict) => toRuntimeConflict(conflict).id)),
            ...enterpriseSolution.services.flatMap((entry) => entry.conflicts.map((conflict) => toRuntimeConflict(conflict).id)),
          ],
        ),
      },
    };

    const compilationContext: RuntimeCompilationContext = {
      compilerVersion,
      passVersion,
      pipelineVersion,
      compiledAt,
      sourceSolutionHash: input.deterministicHash,
      sourceObjectCount:
        enterpriseSolution.modules.length
        + enterpriseSolution.applications.length
        + enterpriseSolution.services.length
        + enterpriseSolution.apis.length
        + enterpriseSolution.runtime.length
        + enterpriseSolution.deployment.length,
      sourceIds: uniqueSorted(enterpriseSolution.modules.map((entry) => entry.identity.id)),
      deterministicRunId: `runtime-run-${input.deterministicHash.slice(0, 12)}`,
    };

    const provisionalMetrics: RuntimeCompilationMetrics = {
      inputSolutionObjectCount: compilationContext.sourceObjectCount,
      runtimeModuleCount: modules.length,
      runtimeApplicationCount: applications.length,
      runtimeServiceCount: services.length,
      runtimeApiCount: apis.length,
      databaseBindingCount: databaseBindings.length,
      storageBindingCount: storageBindings.length,
      messagingBindingCount: messagingBindings.length,
      workflowBindingCount: workflowBindings.length,
      integrationBindingCount: integrationBindings.length,
      schedulerBindingCount: schedulerBindings.length,
      eventBindingCount: eventBindings.length,
      securityBindingCount: authenticationBindings.length + authorizationBindings.length,
      configurationBindingCount: configurationBindings.length,
      providerBindingCount: providerBindings.length,
      pluginBindingCount: pluginBindings.length,
      agentBindingCount: agentBindings.length,
      executionGraphNodeCount: executionGraph.nodes.length,
      executionGraphEdgeCount: executionGraph.edges.length,
      blockingDiagnosticCount: 0,
      warningCount: 0,
      validationDurationMs: 0,
      compilationDurationMs: 0,
      canonicalHash: "",
      passVersion,
      compilerVersion,
    };

    const provisionalIR: EnterpriseRuntimeIR = {
      schemaVersion: "1.0.0",
      enterpriseRuntime,
      compilationContext,
      diagnostics,
      metrics: provisionalMetrics,
      validation: {
        passed: true,
        blockingErrorCount: 0,
        warningCount: 0,
        diagnosticsCount: diagnostics.length,
      },
      deterministicHash: "",
      deterministicSerialization: "",
      compiledFromSolutionHash: input.deterministicHash,
      generatedAt: compiledAt,
    };

    const deterministicSerialization = this.hasher.serialize(provisionalIR);
    const deterministicHash = this.hasher.hash({ ...provisionalIR, deterministicSerialization });

    const computedIR: EnterpriseRuntimeIR = {
      ...provisionalIR,
      deterministicSerialization,
      deterministicHash,
      metrics: {
        ...provisionalMetrics,
        canonicalHash: deterministicHash,
      },
    };

    diagnostics.push(...this.validator.validate(computedIR));
    const validation = this.validator.summarize(diagnostics);

    const finalIR: EnterpriseRuntimeIR = deepFreeze({
      ...computedIR,
      diagnostics: diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
      enterpriseRuntime: {
        ...computedIR.enterpriseRuntime,
        diagnostics: diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
        validation,
      },
      validation,
      metrics: {
        ...computedIR.metrics,
        blockingDiagnosticCount: diagnostics.filter((entry) => entry.blocking && entry.severity === "error").length,
        warningCount: diagnostics.filter((entry) => entry.severity === "warning").length,
      },
    });

    const hashedIR = deepFreeze({
      ...finalIR,
      deterministicSerialization: this.hasher.serialize(finalIR),
    });

    const stableHash = this.hasher.hash(hashedIR);
    const resultIR = deepFreeze({
      ...hashedIR,
      deterministicHash: stableHash,
      metrics: {
        ...hashedIR.metrics,
        canonicalHash: stableHash,
      },
    });

    const result: RuntimeCompilationResult = {
      success: !this.validator.hasBlockingErrors(resultIR.diagnostics),
      enterpriseRuntimeIR: resultIR,
      diagnostics: resultIR.diagnostics,
      metrics: resultIR.metrics,
      validation: resultIR.validation,
      hash: resultIR.deterministicHash,
      compilationMetadata: resultIR.compilationContext,
    };

    if (!result.success) {
      throw new Error(
        `Runtime compilation failed: ${result.diagnostics
          .filter((entry) => entry.blocking && entry.severity === "error")
          .map((entry) => `${entry.code} ${entry.message}`)
          .join("; ")}`,
      );
    }

    return result;
  }
}
