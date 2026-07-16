import type {
  ApiSolution,
  ApplicationSolution,
  AuthenticationSolution,
  AuthorizationSolution,
  AutomationSolution,
  ConfigurationSolution,
  DatabaseSolution,
  DeploymentSolution,
  EnterpriseSolution,
  IntegrationSolution,
  MessagingSolution,
  ModuleSolution,
  MonitoringSolution,
  NotificationSolution,
  PortalSolution,
  ReportingSolution,
  RuntimeSolution,
  SearchSolution,
  SecuritySolution,
  ServiceSolution,
  SolutionCompilationContext,
  SolutionCompilationMetrics,
  SolutionCompilationResult,
  SolutionCompilerOptions,
  SolutionConflict,
  SolutionDependencyEdge,
  SolutionDependencyGraph,
  SolutionDependencyNode,
  SolutionDiagnostic,
  SolutionIdentity,
  SolutionInput,
  SolutionIR,
  SolutionLineage,
  SolutionObjectBase,
  SolutionProvenance,
  SolutionTemporalValidity,
  SolutionValidationSummary,
  SolutionVersion,
  StorageSolution,
  WorkflowSolution,
} from "./SolutionIR";
import { SolutionHasher } from "./SolutionHasher";
import { SolutionIdentityFactory } from "./SolutionIdentity";
import { SolutionValidator } from "./SolutionValidator";

interface BlueprintSeedObject {
  readonly identity: { readonly id: string };
  readonly semanticType: string;
  readonly canonicalName: string;
  readonly canonicalContent: string;
  readonly version: SolutionVersion;
  readonly lineage: SolutionLineage;
  readonly provenance: SolutionProvenance;
  readonly confidence: SolutionObjectBase["confidence"];
  readonly temporalValidity: SolutionTemporalValidity;
  readonly conflicts: readonly { identity: { id: string }; conflictType: string; status: string; blocking: boolean; relatedObjectIds: readonly string[] }[];
  readonly diagnosticReferences: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

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

function sortByIdentity<T extends { identity: { id: string } }>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
}

function detectCycles(nodes: readonly SolutionDependencyNode[], edges: readonly SolutionDependencyEdge[]): string[] {
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];
  const cycles: string[] = [];

  const walk = (nodeId: string): void => {
    visiting.add(nodeId);
    path.push(nodeId);

    for (const next of outgoing.get(nodeId) ?? []) {
      if (!visited.has(next) && !visiting.has(next)) {
        walk(next);
      } else if (visiting.has(next)) {
        const index = path.indexOf(next);
        if (index >= 0) {
          cycles.push(path.slice(index).concat(next).join(" -> "));
        }
      }
    }

    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const id of nodes.map((entry) => entry.id).sort((a, b) => a.localeCompare(b))) {
    if (!visited.has(id)) {
      walk(id);
    }
  }

  return uniqueSorted(cycles);
}

function mapConflicts(seed: BlueprintSeedObject): readonly SolutionConflict[] {
  return seed.conflicts.map((conflict) => ({
    id: conflict.identity.id,
    conflictType: conflict.conflictType,
    status: conflict.status === "resolved" ? "resolved" : conflict.blocking ? "blocking" : "non_blocking",
    blocking: conflict.blocking,
    relatedIds: uniqueSorted(conflict.relatedObjectIds),
  }));
}

function toBase(
  seed: BlueprintSeedObject,
  kind: string,
  objectType: string,
  ownerId: string,
  compilerVersion: string,
  payload: unknown,
): SolutionObjectBase {
  const identity: SolutionIdentity = SolutionIdentityFactory.generate({
    kind,
    objectType,
    sourceBlueprintIdentity: seed.identity.id,
    canonicalSemanticPayload: payload,
    versionSemantics: `${seed.version.semver}:${seed.version.revision}`,
  });

  return {
    identity,
    semanticType: kind,
    name: seed.canonicalName,
    content: seed.canonicalContent,
    ownerId,
    version: seed.version,
    lineage: {
      ...seed.lineage,
      compilerStage: "stage-6-solution-compiler",
      transformationPath: [...seed.lineage.transformationPath, "stage-6-solution-compiler"],
    },
    provenance: {
      ...seed.provenance,
      compilerStage: "stage-6-solution-compiler",
    },
    confidence: seed.confidence,
    temporalValidity: seed.temporalValidity,
    conflicts: mapConflicts(seed),
    blueprintReferences: [seed.identity.id],
    compilerStage: "stage-6-solution-compiler",
    compilerVersion,
    validationStatus: "valid",
    diagnosticReferences: [...seed.diagnosticReferences].sort((a, b) => a.localeCompare(b)),
    metadata: seed.metadata,
  };
}

export class SolutionCompiler {
  private readonly hasher = new SolutionHasher();
  private readonly validator = new SolutionValidator();

  compile(input: SolutionInput, options: SolutionCompilerOptions = {}): SolutionIR {
    return this.compileWithResult(input, options).solutionIR;
  }

  compileWithResult(input: SolutionInput, options: SolutionCompilerOptions = {}): SolutionCompilationResult {
    const compilerVersion = options.compilerVersion ?? "1.0.0";
    const pipelineVersion = options.pipelineVersion ?? "1.0.0";
    const compiledAt = options.compiledAt ?? input.generatedAt;
    const diagnostics: SolutionDiagnostic[] = [];

    const blueprint = input.enterpriseBlueprint;

    const modules: ModuleSolution[] = sortByIdentity(blueprint.modules.map((module) => ({
      ...toBase(module, "module-solution", "module", module.parentBoundedContextId, compilerVersion, {
        blueprintId: module.identity.id,
      }),
      applicationIds: [],
    })));

    const applications: ApplicationSolution[] = sortByIdentity(blueprint.applications.map((application) => ({
      ...toBase(application, "application-solution", "application", application.parentModuleId, compilerVersion, {
        blueprintId: application.identity.id,
      }),
      moduleId: application.parentModuleId,
      serviceIds: [],
    })));

    const services: ServiceSolution[] = sortByIdentity(blueprint.services.map((service) => ({
      ...toBase(service, "service-solution", "service", service.parentApplicationId, compilerVersion, {
        blueprintId: service.identity.id,
      }),
      applicationId: service.parentApplicationId,
      apiIds: [],
    })));

    const apis: ApiSolution[] = sortByIdentity(blueprint.apis.map((api) => ({
      ...toBase(api, "api-solution", "api", api.parentServiceId, compilerVersion, {
        blueprintId: api.identity.id,
      }),
      serviceId: api.parentServiceId,
    })));

    const databases: DatabaseSolution[] = sortByIdentity(blueprint.databases.map((database) => ({
      ...toBase(database, "database-solution", "database", database.parentModuleId, compilerVersion, {
        blueprintId: database.identity.id,
      }),
      moduleId: database.parentModuleId,
    })));

    const workflows: WorkflowSolution[] = sortByIdentity(blueprint.workflows.map((workflow) => ({
      ...toBase(workflow, "workflow-solution", "workflow", workflow.parentDomainId, compilerVersion, {
        blueprintId: workflow.identity.id,
      }),
      serviceIds: [...workflow.serviceIds].sort((a, b) => a.localeCompare(b)),
    })));

    const integrations: IntegrationSolution[] = sortByIdentity(blueprint.integrations.map((integration) => ({
      ...toBase(integration, "integration-solution", "integration", integration.sourceServiceId, compilerVersion, {
        blueprintId: integration.identity.id,
      }),
      sourceServiceId: integration.sourceServiceId,
      targetServiceId: integration.targetServiceId,
    })));

    const runtime: RuntimeSolution[] = sortByIdentity(blueprint.runtime.map((entry) => ({
      ...toBase(entry, "runtime-solution", "runtime", blueprint.enterprise.identity.id, compilerVersion, {
        blueprintId: entry.identity.id,
      }),
      deploymentIds: [],
    })));

    const deployment: DeploymentSolution[] = sortByIdentity(blueprint.deployments.map((entry) => ({
      ...toBase(entry, "deployment-solution", "deployment", blueprint.enterprise.identity.id, compilerVersion, {
        blueprintId: entry.identity.id,
      }),
      runtimeIds: [...entry.runtimeIds].sort((a, b) => a.localeCompare(b)),
    })));

    const security: SecuritySolution[] = sortByIdentity(blueprint.security.map((entry) => ({
      ...toBase(entry, "security-solution", "security", blueprint.enterprise.identity.id, compilerVersion, {
        blueprintId: entry.identity.id,
      }),
      runtimeId: runtime[0]?.identity.id ?? "",
    })));

    const monitoring: MonitoringSolution[] = sortByIdentity(blueprint.monitoring.map((entry) => ({
      ...toBase(entry, "monitoring-solution", "monitoring", entry.runtimeId, compilerVersion, {
        blueprintId: entry.identity.id,
      }),
      runtimeId: entry.runtimeId,
    })));

    const configuration: ConfigurationSolution[] = sortByIdentity(blueprint.configurations.map((entry) => ({
      ...toBase(entry, "configuration-solution", "configuration", entry.environmentId, compilerVersion, {
        blueprintId: entry.identity.id,
      }),
      runtimeId: runtime[0]?.identity.id ?? "",
    })));

    const messaging: MessagingSolution[] = sortByIdentity(blueprint.messaging.map((entry) => ({
      ...toBase(entry, "messaging-solution", "messaging", entry.runtimeId, compilerVersion, {
        blueprintId: entry.identity.id,
      }),
      runtimeId: entry.runtimeId,
    })));

    const search: SearchSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.apis[0], "search-solution", "search", blueprint.enterprise.identity.id, compilerVersion, {
          apiIds: blueprint.apis.map((entry) => entry.identity.id),
        }),
        apiIds: blueprint.apis.map((entry) => entry.identity.id).sort((a, b) => a.localeCompare(b)),
      },
    ]);

    const storage: StorageSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.storage[0], "storage-solution", "storage", blueprint.infrastructure[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          databaseIds: databases.map((entry) => entry.identity.id),
        }),
        databaseIds: databases.map((entry) => entry.identity.id).sort((a, b) => a.localeCompare(b)),
      },
    ]);

    const reporting: ReportingSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.monitoring[0], "reporting-solution", "reporting", runtime[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          runtimeId: runtime[0]?.identity.id ?? "",
        }),
        runtimeId: runtime[0]?.identity.id ?? "",
      },
    ]);

    const portals: PortalSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.applications[0], "portal-solution", "portal", blueprint.applications[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          applicationId: blueprint.applications[0]?.identity.id ?? "",
        }),
        applicationId: blueprint.applications[0]?.identity.id ?? "",
      },
    ]);

    const automation: AutomationSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.workflows[0], "automation-solution", "automation", blueprint.workflows[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          workflowId: blueprint.workflows[0]?.identity.id ?? "",
        }),
        workflowId: blueprint.workflows[0]?.identity.id ?? "",
      },
    ]);

    const authentication: AuthenticationSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.roles[0], "authentication-solution", "authentication", runtime[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          runtimeId: runtime[0]?.identity.id ?? "",
        }),
        runtimeId: runtime[0]?.identity.id ?? "",
      },
    ]);

    const authorization: AuthorizationSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.policies[0], "authorization-solution", "authorization", runtime[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          runtimeId: runtime[0]?.identity.id ?? "",
        }),
        runtimeId: runtime[0]?.identity.id ?? "",
      },
    ]);

    const notifications: NotificationSolution[] = sortByIdentity([
      {
        ...toBase(blueprint.events[0], "notification-solution", "notification", messaging[0]?.identity.id ?? blueprint.enterprise.identity.id, compilerVersion, {
          messagingId: messaging[0]?.identity.id ?? "",
        }),
        messagingId: messaging[0]?.identity.id ?? "",
      },
    ]);

    const moduleIdByBlueprintId = new Map(modules.map((entry) => [entry.blueprintReferences[0], entry.identity.id]));
    const applicationIdByBlueprintId = new Map(applications.map((entry) => [entry.blueprintReferences[0], entry.identity.id]));
    const serviceIdByBlueprintId = new Map(services.map((entry) => [entry.blueprintReferences[0], entry.identity.id]));
    const runtimeIdByBlueprintId = new Map(runtime.map((entry) => [entry.blueprintReferences[0], entry.identity.id]));

    const applicationsMapped = sortByIdentity(applications.map((entry) => ({
      ...entry,
      ownerId: moduleIdByBlueprintId.get(entry.moduleId) ?? entry.ownerId,
      moduleId: moduleIdByBlueprintId.get(entry.moduleId) ?? entry.moduleId,
    })));

    const servicesMapped = sortByIdentity(services.map((entry) => ({
      ...entry,
      ownerId: applicationIdByBlueprintId.get(entry.applicationId) ?? entry.ownerId,
      applicationId: applicationIdByBlueprintId.get(entry.applicationId) ?? entry.applicationId,
    })));

    const apisMapped = sortByIdentity(apis.map((entry) => ({
      ...entry,
      ownerId: serviceIdByBlueprintId.get(entry.serviceId) ?? entry.ownerId,
      serviceId: serviceIdByBlueprintId.get(entry.serviceId) ?? entry.serviceId,
    })));

    const databasesMapped = sortByIdentity(databases.map((entry) => ({
      ...entry,
      ownerId: moduleIdByBlueprintId.get(entry.moduleId) ?? entry.ownerId,
      moduleId: moduleIdByBlueprintId.get(entry.moduleId) ?? entry.moduleId,
    })));

    const workflowsMapped = sortByIdentity(workflows.map((entry) => ({
      ...entry,
      serviceIds: entry.serviceIds.map((serviceId) => serviceIdByBlueprintId.get(serviceId) ?? serviceId).sort((a, b) => a.localeCompare(b)),
    })));

    const integrationsMapped = sortByIdentity(integrations.map((entry) => ({
      ...entry,
      ownerId: serviceIdByBlueprintId.get(entry.sourceServiceId) ?? entry.ownerId,
      sourceServiceId: serviceIdByBlueprintId.get(entry.sourceServiceId) ?? entry.sourceServiceId,
      targetServiceId: serviceIdByBlueprintId.get(entry.targetServiceId) ?? entry.targetServiceId,
    })));

    const runtimeMapped = sortByIdentity(runtime);

    const deploymentMapped = sortByIdentity(deployment.map((entry) => ({
      ...entry,
      runtimeIds: entry.runtimeIds.map((runtimeId) => runtimeIdByBlueprintId.get(runtimeId) ?? runtimeId).sort((a, b) => a.localeCompare(b)),
    })));

    const monitoringMapped = sortByIdentity(monitoring.map((entry) => ({
      ...entry,
      runtimeId: runtimeIdByBlueprintId.get(entry.runtimeId) ?? runtimeMapped[0]?.identity.id ?? entry.runtimeId,
      ownerId: runtimeIdByBlueprintId.get(entry.runtimeId) ?? runtimeMapped[0]?.identity.id ?? entry.ownerId,
    })));

    const messagingMapped = sortByIdentity(messaging.map((entry) => ({
      ...entry,
      runtimeId: runtimeIdByBlueprintId.get(entry.runtimeId) ?? runtimeMapped[0]?.identity.id ?? entry.runtimeId,
      ownerId: runtimeIdByBlueprintId.get(entry.runtimeId) ?? runtimeMapped[0]?.identity.id ?? entry.ownerId,
    })));

    const securityMapped = sortByIdentity(security.map((entry) => ({
      ...entry,
      runtimeId: runtimeMapped[0]?.identity.id ?? entry.runtimeId,
      ownerId: runtimeMapped[0]?.identity.id ?? entry.ownerId,
    })));

    const configurationMapped = sortByIdentity(configuration.map((entry) => ({
      ...entry,
      runtimeId: runtimeMapped[0]?.identity.id ?? entry.runtimeId,
      ownerId: runtimeMapped[0]?.identity.id ?? entry.ownerId,
    })));

    const modulesWithChildren = sortByIdentity(modules.map((entry) => ({
      ...entry,
      applicationIds: applicationsMapped
        .filter((application) => application.moduleId === entry.ownerId || application.moduleId === entry.identity.id)
        .map((application) => application.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const applicationsWithChildren = sortByIdentity(applicationsMapped.map((entry) => ({
      ...entry,
      serviceIds: servicesMapped
        .filter((service) => service.applicationId === entry.identity.id)
        .map((service) => service.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const servicesWithChildren = sortByIdentity(servicesMapped.map((entry) => ({
      ...entry,
      apiIds: apisMapped
        .filter((api) => api.serviceId === entry.identity.id)
        .map((api) => api.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const runtimeWithChildren = sortByIdentity(runtimeMapped.map((entry) => ({
      ...entry,
      deploymentIds: deploymentMapped
        .filter((dep) => dep.runtimeIds.includes(entry.identity.id))
        .map((dep) => dep.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const nodes: SolutionDependencyNode[] = [
      ...modulesWithChildren.map((entry) => ({ id: entry.identity.id, type: "module", ownerId: entry.ownerId })),
      ...applicationsWithChildren.map((entry) => ({ id: entry.identity.id, type: "application", ownerId: entry.ownerId })),
      ...servicesWithChildren.map((entry) => ({ id: entry.identity.id, type: "service", ownerId: entry.ownerId })),
      ...apisMapped.map((entry) => ({ id: entry.identity.id, type: "api", ownerId: entry.ownerId })),
      ...runtimeWithChildren.map((entry) => ({ id: entry.identity.id, type: "runtime", ownerId: entry.ownerId })),
      ...deploymentMapped.map((entry) => ({ id: entry.identity.id, type: "deployment", ownerId: entry.ownerId })),
      ...workflowsMapped.map((entry) => ({ id: entry.identity.id, type: "workflow", ownerId: entry.ownerId })),
    ].sort((a, b) => a.id.localeCompare(b.id));

    const edges: SolutionDependencyEdge[] = [
      ...applicationsWithChildren.map((entry) => ({ from: entry.moduleId, to: entry.identity.id, relation: "contains" })),
      ...servicesWithChildren.map((entry) => ({ from: entry.applicationId, to: entry.identity.id, relation: "hosts" })),
      ...apisMapped.map((entry) => ({ from: entry.serviceId, to: entry.identity.id, relation: "exposes" })),
      ...runtimeWithChildren.flatMap((entry) => entry.deploymentIds.map((depId) => ({ from: entry.identity.id, to: depId, relation: "deploys" }))),
      ...integrationsMapped
        .filter((entry) => entry.sourceServiceId !== entry.targetServiceId)
        .map((entry) => ({ from: entry.sourceServiceId, to: entry.targetServiceId, relation: "integrates" })),
      ...workflowsMapped.flatMap((entry) => entry.serviceIds.map((serviceId) => ({ from: entry.identity.id, to: serviceId, relation: "orchestrates" }))),
    ]
      .filter((edge) => Boolean(edge.from) && Boolean(edge.to))
      .sort((a, b) => `${a.from}|${a.to}|${a.relation}`.localeCompare(`${b.from}|${b.to}|${b.relation}`));

    const nodeIds = new Set(nodes.map((entry) => entry.id));
    const violations = edges
      .filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to))
      .map((edge) => `${edge.from}->${edge.to}:${edge.relation}`)
      .sort((a, b) => a.localeCompare(b));

    const cyclePaths = detectCycles(nodes, edges);

    const dependencyGraph: SolutionDependencyGraph = {
      nodes,
      edges,
      hasCycle: cyclePaths.length > 0,
      cyclePaths,
      violations,
    };

    const enterpriseSolution: EnterpriseSolution = {
      enterpriseId: blueprint.enterprise.identity.id,
      solutionId: `solution-${input.deterministicHash.slice(0, 16)}`,
      name: `${blueprint.enterprise.canonicalName} Solution`,
      version: "1.0.0",
      applications: applicationsWithChildren,
      modules: modulesWithChildren,
      services: servicesWithChildren,
      apis: apisMapped,
      databases: databasesMapped,
      workflows: workflowsMapped,
      integrations: integrationsMapped,
      runtime: runtimeWithChildren,
      deployment: deploymentMapped,
      security: securityMapped,
      monitoring: monitoringMapped,
      configuration: configurationMapped,
      reporting,
      portals,
      automation,
      authentication,
      authorization,
      notifications,
      search,
      storage,
      messaging: messagingMapped,
      dependencyGraph,
      metadata: {
        sourceBlueprintHash: input.deterministicHash,
        sourceBlueprintVersion: blueprint.version,
      },
      lineage: blueprint.enterprise.lineage,
      provenance: blueprint.enterprise.provenance,
      confidence: blueprint.enterprise.confidence,
    };

    const compilationContext: SolutionCompilationContext = {
      compilerVersion,
      pipelineVersion,
      compiledAt,
      sourceBlueprintHash: input.deterministicHash,
      sourceObjectCount:
        blueprint.modules.length
        + blueprint.applications.length
        + blueprint.services.length
        + blueprint.apis.length
        + blueprint.runtime.length
        + blueprint.deployments.length,
      sourceIds: uniqueSorted(blueprint.modules.map((entry) => entry.identity.id)),
      deterministicRunId: `sol-run-${input.deterministicHash.slice(0, 12)}`,
    };

    const provisionalMetrics: SolutionCompilationMetrics = {
      applicationsProjected: applicationsWithChildren.length,
      modulesProjected: modulesWithChildren.length,
      servicesProjected: servicesWithChildren.length,
      apisProjected: apis.length,
      databasesProjected: databases.length,
      workflowsProjected: workflows.length,
      integrationsProjected: integrations.length,
      runtimeProjected: runtimeWithChildren.length,
      deploymentProjected: deployment.length,
      diagnosticsCount: 0,
      validationErrorCount: 0,
      dependencyNodeCount: dependencyGraph.nodes.length,
      dependencyEdgeCount: dependencyGraph.edges.length,
      executionTimeMs: 0,
    };

    const provisionalValidation: SolutionValidationSummary = {
      passed: true,
      blockingErrorCount: 0,
      warningCount: 0,
    };

    const provisionalIR: SolutionIR = {
      schemaVersion: "1.0.0",
      enterpriseSolution,
      compilationContext,
      diagnostics,
      metrics: provisionalMetrics,
      validation: provisionalValidation,
      deterministicHash: "",
      deterministicSerialization: "",
      compiledFromBlueprintHash: input.deterministicHash,
      generatedAt: compiledAt,
    };

    const deterministicSerialization = this.hasher.serialize(provisionalIR);
    const deterministicHash = this.hasher.hash({ ...provisionalIR, deterministicSerialization });

    const computedIR: SolutionIR = {
      ...provisionalIR,
      deterministicSerialization,
      deterministicHash,
    };

    diagnostics.push(...this.validator.validate(computedIR));
    const validatorSummary = this.validator.summarize(enterpriseSolution, diagnostics);

    const metrics: SolutionCompilationMetrics = {
      ...provisionalMetrics,
      diagnosticsCount: diagnostics.length,
      validationErrorCount: diagnostics.filter((entry) => entry.severity === "error").length,
      executionTimeMs: 0,
    };

    const validation: SolutionValidationSummary = {
      passed: validatorSummary.passed,
      blockingErrorCount: validatorSummary.blockingErrorCount,
      warningCount: validatorSummary.warningCount,
    };

    const finalIR: SolutionIR = deepFreeze({
      ...computedIR,
      diagnostics: diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
      metrics,
      validation,
      deterministicSerialization: this.hasher.serialize({ ...computedIR, diagnostics, metrics, validation }),
    });

    const hashedIR = deepFreeze({ ...finalIR, deterministicHash: this.hasher.hash(finalIR) });

    const result: SolutionCompilationResult = {
      success: !this.validator.hasBlockingErrors(hashedIR.diagnostics),
      solutionIR: hashedIR,
      diagnostics: hashedIR.diagnostics,
      metrics: hashedIR.metrics,
      validation: hashedIR.validation,
      hash: hashedIR.deterministicHash,
      compilationMetadata: hashedIR.compilationContext,
    };

    if (!result.success) {
      throw new Error(
        `Solution compilation failed: ${result.diagnostics
          .filter((entry) => entry.severity === "error")
          .map((entry) => `${entry.code} ${entry.message}`)
          .join("; ")}`,
      );
    }

    return result;
  }
}
