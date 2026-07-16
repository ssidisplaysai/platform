import { stableStringify } from "../core/stableStringify";
import type {
  BlueprintCompilationContext,
  BlueprintCompilationMetrics,
  BlueprintCompilationResult,
  BlueprintCompilerOptions,
  BlueprintConfidence,
  BlueprintConflict,
  BlueprintDependencyEdge,
  BlueprintDependencyGraph,
  BlueprintDependencyNode,
  BlueprintDiagnostic,
  BlueprintInput,
  BlueprintLineage,
  BlueprintObjectBase,
  BlueprintProvenance,
  BlueprintTemporalValidity,
  BlueprintVersion,
  EnterpriseBlueprint,
  EnterpriseBlueprintIR,
  AggregateDefinition,
  ApiDefinition,
  ApplicationDefinition,
  BoundedContextDefinition,
  CommandDefinition,
  ConfigurationDefinition,
  DatabaseDefinition,
  DeploymentDefinition,
  DomainDefinition,
  EntityDefinition,
  EnvironmentDefinition,
  EventDefinition,
  InfrastructureDefinition,
  IntegrationDefinition,
  MessagingDefinition,
  ModuleDefinition,
  MonitoringDefinition,
  NetworkDefinition,
  PermissionDefinition,
  PolicyDefinition,
  QueryDefinition,
  RepositoryDefinition,
  RoleDefinition,
  RuntimeDefinition,
  SchedulingDefinition,
  SchemaDefinition,
  SecretReferenceDefinition,
  SecurityDefinition,
  ServiceDefinition,
  StorageDefinition,
  ValueObjectDefinition,
  WorkflowDefinition,
  EnterpriseDefinition,
} from "./BlueprintIR";
import { BlueprintHasher } from "./BlueprintHasher";
import { BlueprintIdentityFactory } from "./BlueprintIdentity";
import { BlueprintValidator } from "./BlueprintValidator";

interface BlueprintSourceObject {
  readonly identity: { readonly id: string };
  readonly canonicalName: string;
  readonly canonicalContent: string;
  readonly version: BlueprintVersion;
  readonly provenance: BlueprintProvenance;
  readonly lineage: BlueprintLineage;
  readonly confidence: BlueprintConfidence;
  readonly temporalValidity: BlueprintTemporalValidity;
  readonly metadata: Readonly<Record<string, unknown>>;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry as T);
    }
  }

  return value;
}

function sortByIdentity<T extends { identity: { id: string } }>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
}

function idForName(values: readonly { canonicalName: string; identity: { id: string } }[], name: string): string {
  const normalized = name.toLowerCase();
  const match = values.find((value) => value.canonicalName.toLowerCase() === normalized);
  return match?.identity.id ?? values[0]?.identity.id ?? "";
}

function detectCycle(nodes: readonly BlueprintDependencyNode[], edges: readonly BlueprintDependencyEdge[]): string[] {
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    outgoing.set(node.id, []);
  }
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[] = [];

  const dfs = (nodeId: string): void => {
    visited.add(nodeId);
    inStack.add(nodeId);
    stack.push(nodeId);

    for (const next of outgoing.get(nodeId) ?? []) {
      if (!visited.has(next)) {
        dfs(next);
      } else if (inStack.has(next)) {
        const start = stack.indexOf(next);
        if (start >= 0) {
          cycles.push(stack.slice(start).concat(next).join(" -> "));
        }
      }
    }

    stack.pop();
    inStack.delete(nodeId);
  };

  for (const node of nodes.map((entry) => entry.id).sort((a, b) => a.localeCompare(b))) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return uniqueSorted(cycles);
}

function toBase(
  source: BlueprintSourceObject,
  semanticType: string,
  compilerVersion: string,
  enterpriseScope: string,
  domainScope: string,
  moduleScope: string,
  parentRelationships: readonly string[],
  canonicalSemanticContent: unknown,
): BlueprintObjectBase {
  const identity = BlueprintIdentityFactory.generate({
    kind: semanticType,
    objectType: semanticType,
    enterpriseScope,
    domainScope,
    moduleScope,
    parentRelationships,
    temporalScope: `${source.temporalValidity.validFrom}|${source.temporalValidity.validTo ?? "open"}`,
    lineageSignature: stableStringify(source.lineage),
    versionSemantics: `${source.version.semver}:${source.version.revision}`,
    canonicalSemanticContent,
  });

  return {
    identity,
    semanticType,
    canonicalName: source.canonicalName,
    canonicalContent: source.canonicalContent,
    version: source.version as BlueprintVersion,
    provenance: source.provenance as BlueprintProvenance,
    lineage: {
      ...(source.lineage as BlueprintLineage),
      compilerStage: "stage-5-blueprint-compiler",
      transformationPath: [...source.lineage.transformationPath, "stage-5-blueprint-compiler"],
    },
    confidence: source.confidence as BlueprintConfidence,
    temporalValidity: source.temporalValidity as BlueprintTemporalValidity,
    conflicts: [] as readonly BlueprintConflict[],
    businessGenomeReferences: [source.identity.id],
    knowledgeReferences: [source.lineage.sourceKnowledgeId],
    evidenceReferences: source.lineage.sourceEvidenceIds,
    compilerStage: "stage-5-blueprint-compiler",
    compilerVersion,
    validationStatus: "valid",
    diagnosticReferences: [],
    metadata: source.metadata,
  };
}

export class BlueprintCompiler {
  private readonly hasher = new BlueprintHasher();
  private readonly validator = new BlueprintValidator();

  compile(input: BlueprintInput, options: BlueprintCompilerOptions = {}): EnterpriseBlueprintIR {
    return this.compileWithResult(input, options).enterpriseBlueprintIR;
  }

  compileWithResult(input: BlueprintInput, options: BlueprintCompilerOptions = {}): BlueprintCompilationResult {
    const compilerVersion = options.compilerVersion ?? "1.0.0";
    const pipelineVersion = options.pipelineVersion ?? "1.0.0";
    const compiledAt = options.compiledAt ?? input.generatedAt;
    const diagnostics: BlueprintDiagnostic[] = [];

    const genome = input.businessGenome;
    const entities = [...genome.entities].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const capabilities = [...genome.capabilities].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const processes = [...genome.processes].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const policiesGenome = [...genome.policies].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const rolesGenome = [...genome.roles].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const resources = [...genome.resources].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const eventsGenome = [...genome.events].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
    const workflowsGenome = [...genome.workflows].sort((a, b) => a.identity.id.localeCompare(b.identity.id));

    const enterpriseSeed = entities[0] ?? capabilities[0] ?? processes[0] ?? resources[0] ?? genome.conflicts[0];
    if (!enterpriseSeed) {
      throw new Error("Blueprint compilation failed: missing enterprise seed in business genome");
    }

    const enterpriseBase = toBase(
      enterpriseSeed,
      "enterprise-definition",
      compilerVersion,
      input.compilationContext.sourceIds[0] ?? "enterprise",
      "global",
      "global",
      [],
      {
        sourceBusinessGenomeHash: input.deterministicHash,
      },
    );

    const domainNames = uniqueSorted(
      entities.map((entry) => String(entry.metadata["domain"] ?? "enterprise-domain")),
    );

    const domains: DomainDefinition[] = sortByIdentity(
      domainNames.map((name, index) => {
        const seed = entities[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "domain-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          name,
          "domain",
          [enterpriseBase.identity.id],
          { name },
        );

        return {
          ...base,
          canonicalName: `${name} Domain`,
          parentEnterpriseId: enterpriseBase.identity.id,
          boundedContextIds: [],
        };
      }),
    );

    const boundedContexts: BoundedContextDefinition[] = sortByIdentity(
      domains.map((domain, index) => {
        const seed = capabilities[index] ?? processes[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "bounded-context-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domain.identity.id,
          "context",
          [domain.identity.id],
          { domain: domain.canonicalName },
        );

        return {
          ...base,
          canonicalName: `${domain.canonicalName} Context`,
          parentDomainId: domain.identity.id,
          moduleIds: [],
        };
      }),
    );

    const modules: ModuleDefinition[] = sortByIdentity(
      (capabilities.length > 0 ? capabilities : [enterpriseSeed]).map((capability, index) => {
        const context = boundedContexts[index % boundedContexts.length];
        const base = toBase(
          capability,
          "module-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          context.parentDomainId,
          capability.identity.id,
          [context.identity.id],
          { capabilityId: capability.identity.id },
        );

        return {
          ...base,
          canonicalName: `${capability.canonicalName} Module`,
          parentBoundedContextId: context.identity.id,
          applicationIds: [],
        };
      }),
    );

    const applications: ApplicationDefinition[] = sortByIdentity(
      modules.map((module, index) => {
        const seed = processes[index] ?? capabilities[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "application-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          module.identity.id,
          [module.identity.id],
          { moduleId: module.identity.id },
        );

        return {
          ...base,
          canonicalName: `${module.canonicalName} App`,
          parentModuleId: module.identity.id,
          serviceIds: [],
        };
      }),
    );

    const services: ServiceDefinition[] = sortByIdentity(
      (processes.length > 0 ? processes : [enterpriseSeed]).map((process, index) => {
        const app = applications[index % applications.length];
        const base = toBase(
          process,
          "service-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          app.parentModuleId,
          [app.identity.id],
          { processId: process.identity.id },
        );

        return {
          ...base,
          canonicalName: `${process.canonicalName} Service`,
          parentApplicationId: app.identity.id,
          apiIds: [],
          repositoryIds: [],
        };
      }),
    );

    const apis: ApiDefinition[] = sortByIdentity(
      services.map((service, index) => {
        const seed = genome.relationships[index] ?? processes[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "api-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          service.identity.id,
          [service.identity.id],
          { serviceId: service.identity.id },
        );

        return {
          ...base,
          canonicalName: `${service.canonicalName} API`,
          parentServiceId: service.identity.id,
          commandIds: [],
          queryIds: [],
          eventIds: [],
        };
      }),
    );

    const databases: DatabaseDefinition[] = sortByIdentity(
      (resources.length > 0 ? resources : [enterpriseSeed]).map((resource, index) => {
        const moduleDef = modules[index % modules.length];
        const base = toBase(
          resource,
          "database-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          moduleDef.identity.id,
          [moduleDef.identity.id],
          { resourceId: resource.identity.id },
        );

        return {
          ...base,
          canonicalName: `${resource.canonicalName} Database`,
          parentModuleId: moduleDef.identity.id,
          schemaIds: [],
        };
      }),
    );

    const schemas: SchemaDefinition[] = sortByIdentity(
      databases.map((database, index) => {
        const seed = entities[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "schema-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          database.identity.id,
          [database.identity.id],
          { databaseId: database.identity.id },
        );

        return {
          ...base,
          canonicalName: `${database.canonicalName} Schema`,
          parentDatabaseId: database.identity.id,
          aggregateIds: [],
        };
      }),
    );

    const aggregates: AggregateDefinition[] = sortByIdentity(
      entities.map((entity, index) => {
        const schema = schemas[index % schemas.length];
        const base = toBase(
          entity,
          "aggregate-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          schema.identity.id,
          [schema.identity.id],
          { entityId: entity.identity.id },
        );

        return {
          ...base,
          canonicalName: `${entity.canonicalName} Aggregate`,
          parentSchemaId: schema.identity.id,
          entityIds: [],
          valueObjectIds: [],
        };
      }),
    );

    const entityDefinitions: EntityDefinition[] = sortByIdentity(
      entities.map((entity, index) => {
        const aggregate = aggregates[index % aggregates.length];
        const base = toBase(
          entity,
          "entity-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          aggregate.identity.id,
          [aggregate.identity.id],
          { entityId: entity.identity.id },
        );

        return {
          ...base,
          canonicalName: `${entity.canonicalName} Entity`,
          parentAggregateId: aggregate.identity.id,
          repositoryIds: [],
        };
      }),
    );

    const valueObjects: ValueObjectDefinition[] = sortByIdentity(
      genome.constraints.map((constraint, index) => {
        const aggregate = aggregates[index % aggregates.length];
        const base = toBase(
          constraint,
          "value-object-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          aggregate.identity.id,
          [aggregate.identity.id],
          { constraintId: constraint.identity.id },
        );

        return {
          ...base,
          canonicalName: `${constraint.canonicalName} Value Object`,
          parentAggregateId: aggregate.identity.id,
        };
      }),
    );

    const repositories: RepositoryDefinition[] = sortByIdentity(
      services.map((service, index) => {
        const seed = entityDefinitions[index % entityDefinitions.length] ?? entityDefinitions[0];
        const base = toBase(
          seed,
          "repository-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          service.identity.id,
          [service.identity.id],
          { serviceId: service.identity.id },
        );

        return {
          ...base,
          canonicalName: `${service.canonicalName} Repository`,
          parentServiceId: service.identity.id,
          entityIds: entityDefinitions.map((entry) => entry.identity.id),
        };
      }),
    );

    const commands: CommandDefinition[] = sortByIdentity(
      apis.map((api, index) => {
        const seed = processes[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "command-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          api.identity.id,
          [api.identity.id],
          { apiId: api.identity.id },
        );

        return {
          ...base,
          canonicalName: `${api.canonicalName} Command`,
          parentApiId: api.identity.id,
          targetEntityIds: entityDefinitions.map((entry) => entry.identity.id),
        };
      }),
    );

    const queries: QueryDefinition[] = sortByIdentity(
      apis.map((api, index) => {
        const seed = genome.metrics[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "query-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          api.identity.id,
          [api.identity.id],
          { apiId: api.identity.id },
        );

        return {
          ...base,
          canonicalName: `${api.canonicalName} Query`,
          parentApiId: api.identity.id,
          targetEntityIds: entityDefinitions.map((entry) => entry.identity.id),
        };
      }),
    );

    const workflows: WorkflowDefinition[] = sortByIdentity(
      (workflowsGenome.length > 0 ? workflowsGenome : [enterpriseSeed]).map((workflow, index) => {
        const domain = domains[index % domains.length];
        const base = toBase(
          workflow,
          "workflow-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domain.identity.id,
          modules[index % modules.length]?.identity.id ?? modules[0].identity.id,
          [domain.identity.id],
          { workflowId: workflow.identity.id },
        );

        return {
          ...base,
          canonicalName: `${workflow.canonicalName} Workflow`,
          parentDomainId: domain.identity.id,
          eventIds: [],
          serviceIds: services.map((entry) => entry.identity.id),
        };
      }),
    );

    const events: EventDefinition[] = sortByIdentity(
      (eventsGenome.length > 0 ? eventsGenome : [enterpriseSeed]).map((event, index) => {
        const api = apis[index % apis.length];
        const base = toBase(
          event,
          "event-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          api.identity.id,
          [api.identity.id],
          { eventId: event.identity.id },
        );

        return {
          ...base,
          canonicalName: `${event.canonicalName} Event`,
          parentApiId: api.identity.id,
          workflowIds: workflows.map((entry) => entry.identity.id),
        };
      }),
    );

    const integrationSeeds = services.length > 1 ? services : [];
    const integrations: IntegrationDefinition[] = sortByIdentity(
      integrationSeeds.map((service, index) => {
        const target = services[(index + 1) % services.length];
        if (!target || target.identity.id === service.identity.id) {
          return null;
        }
        const seed = genome.relationships[index] ?? enterpriseSeed;
        const base = toBase(
          seed,
          "integration-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          service.identity.id,
          [service.identity.id, target.identity.id],
          { sourceService: service.identity.id, targetService: target.identity.id },
        );

        return {
          ...base,
          canonicalName: `${service.canonicalName} Integration`,
          sourceServiceId: service.identity.id,
          targetServiceId: target.identity.id,
          integrationType: "service-link",
        };
      }).filter((entry): entry is IntegrationDefinition => Boolean(entry)),
    );

    const permissions: PermissionDefinition[] = sortByIdentity(
      (rolesGenome.length > 0 ? rolesGenome : [enterpriseSeed]).map((role, index) => {
        const seed = policiesGenome[index] ?? role;
        const base = toBase(
          seed,
          "permission-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          modules[index % modules.length]?.identity.id ?? modules[0].identity.id,
          [role.identity.id],
          { roleId: role.identity.id },
        );

        return {
          ...base,
          canonicalName: `${role.canonicalName} Permission`,
          roleIds: [role.identity.id],
          policyIds: policiesGenome.map((entry) => entry.identity.id),
        };
      }),
    );

    const roleDefinitions: RoleDefinition[] = sortByIdentity(
      (rolesGenome.length > 0 ? rolesGenome : [enterpriseSeed]).map((role, index) => {
        const permission = permissions[index % permissions.length];
        const base = toBase(
          role,
          "role-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          modules[index % modules.length]?.identity.id ?? modules[0].identity.id,
          [permission.identity.id],
          { roleId: role.identity.id },
        );

        return {
          ...base,
          canonicalName: `${role.canonicalName} Role`,
          permissionIds: [permission.identity.id],
        };
      }),
    );

    const policyDefinitions: PolicyDefinition[] = sortByIdentity(
      (policiesGenome.length > 0 ? policiesGenome : [enterpriseSeed]).map((policy, index) => {
        const permission = permissions[index % permissions.length];
        const base = toBase(
          policy,
          "policy-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[index % domains.length]?.identity.id ?? domains[0].identity.id,
          modules[index % modules.length]?.identity.id ?? modules[0].identity.id,
          [permission.identity.id],
          { policyId: policy.identity.id },
        );

        return {
          ...base,
          canonicalName: `${policy.canonicalName} Policy`,
          permissionIds: [permission.identity.id],
        };
      }),
    );

    const runtime: RuntimeDefinition[] = sortByIdentity([
      {
        ...toBase(
          resources[0] ?? enterpriseSeed,
          "runtime-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          modules[0].identity.id,
          [modules[0].identity.id],
          { runtime: "primary" },
        ),
        canonicalName: "Primary Runtime",
        environmentIds: [],
        dependencyNodeIds: [],
      },
    ]);

    const infrastructure: InfrastructureDefinition[] = sortByIdentity([
      {
        ...toBase(
          resources[0] ?? enterpriseSeed,
          "infrastructure-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          modules[0].identity.id,
          [runtime[0].identity.id],
          { infrastructure: "primary" },
        ),
        canonicalName: "Primary Infrastructure",
        networkIds: [],
        storageIds: [],
        securityIds: [],
      },
    ]);

    const environments: EnvironmentDefinition[] = sortByIdentity([
      {
        ...toBase(
          resources[0] ?? enterpriseSeed,
          "environment-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          runtime[0].identity.id,
          [runtime[0].identity.id],
          { environment: "production" },
        ),
        canonicalName: "Production Environment",
        configurationIds: [],
        secretReferenceIds: [],
      },
    ]);

    const deployments: DeploymentDefinition[] = sortByIdentity([
      {
        ...toBase(
          resources[0] ?? enterpriseSeed,
          "deployment-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          runtime[0].identity.id,
          [runtime[0].identity.id, environments[0].identity.id],
          { deployment: "primary" },
        ),
        canonicalName: "Primary Deployment",
        environmentIds: [environments[0].identity.id],
        runtimeIds: [runtime[0].identity.id],
      },
    ]);

    const configurations: ConfigurationDefinition[] = sortByIdentity([
      {
        ...toBase(
          resources[0] ?? enterpriseSeed,
          "configuration-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          environments[0].identity.id,
          [environments[0].identity.id],
          { configuration: "runtime-config" },
        ),
        canonicalName: "Runtime Configuration",
        environmentId: environments[0].identity.id,
      },
    ]);

    const secretReferences: SecretReferenceDefinition[] = sortByIdentity([
      {
        ...toBase(
          policiesGenome[0] ?? enterpriseSeed,
          "secret-reference-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          environments[0].identity.id,
          [environments[0].identity.id],
          { secretReference: "primary" },
        ),
        canonicalName: "Primary Secret Reference",
        environmentId: environments[0].identity.id,
      },
    ]);

    const monitoring: MonitoringDefinition[] = sortByIdentity([
      {
        ...toBase(
          genome.metrics[0] ?? enterpriseSeed,
          "monitoring-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          runtime[0].identity.id,
          [runtime[0].identity.id],
          { monitoring: "primary" },
        ),
        canonicalName: "Primary Monitoring",
        runtimeId: runtime[0].identity.id,
      },
    ]);

    const scheduling: SchedulingDefinition[] = sortByIdentity([
      {
        ...toBase(
          workflowsGenome[0] ?? enterpriseSeed,
          "scheduling-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          runtime[0].identity.id,
          [runtime[0].identity.id],
          { scheduling: "primary" },
        ),
        canonicalName: "Primary Scheduling",
        runtimeId: runtime[0].identity.id,
      },
    ]);

    const messaging: MessagingDefinition[] = sortByIdentity([
      {
        ...toBase(
          eventsGenome[0] ?? enterpriseSeed,
          "messaging-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          runtime[0].identity.id,
          [runtime[0].identity.id],
          { messaging: "primary" },
        ),
        canonicalName: "Primary Messaging",
        runtimeId: runtime[0].identity.id,
      },
    ]);

    const storage: StorageDefinition[] = sortByIdentity([
      {
        ...toBase(
          databases[0],
          "storage-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          infrastructure[0].identity.id,
          [infrastructure[0].identity.id],
          { storage: "primary" },
        ),
        canonicalName: "Primary Storage",
        infrastructureId: infrastructure[0].identity.id,
      },
    ]);

    const networks: NetworkDefinition[] = sortByIdentity([
      {
        ...toBase(
          integrations[0] ?? services[0],
          "network-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          infrastructure[0].identity.id,
          [infrastructure[0].identity.id],
          { network: "primary" },
        ),
        canonicalName: "Primary Network",
        infrastructureId: infrastructure[0].identity.id,
      },
    ]);

    const security: SecurityDefinition[] = sortByIdentity([
      {
        ...toBase(
          policyDefinitions[0],
          "security-definition",
          compilerVersion,
          enterpriseBase.identity.id,
          domains[0].identity.id,
          infrastructure[0].identity.id,
          [infrastructure[0].identity.id],
          { security: "primary" },
        ),
        canonicalName: "Primary Security",
        infrastructureId: infrastructure[0].identity.id,
      },
    ]);

    const domainsWithChildren = sortByIdentity(domains.map((domain) => ({
      ...domain,
      boundedContextIds: boundedContexts
        .filter((entry) => entry.parentDomainId === domain.identity.id)
        .map((entry) => entry.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const contextsWithChildren = sortByIdentity(boundedContexts.map((context) => ({
      ...context,
      moduleIds: modules
        .filter((entry) => entry.parentBoundedContextId === context.identity.id)
        .map((entry) => entry.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const modulesWithChildren = sortByIdentity(modules.map((moduleDef) => ({
      ...moduleDef,
      applicationIds: applications
        .filter((entry) => entry.parentModuleId === moduleDef.identity.id)
        .map((entry) => entry.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const appsWithChildren = sortByIdentity(applications.map((application) => ({
      ...application,
      serviceIds: services
        .filter((entry) => entry.parentApplicationId === application.identity.id)
        .map((entry) => entry.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));

    const servicesWithChildren = sortByIdentity(services.map((service) => ({
      ...service,
      apiIds: apis.filter((entry) => entry.parentServiceId === service.identity.id).map((entry) => entry.identity.id),
      repositoryIds: repositories
        .filter((entry) => entry.parentServiceId === service.identity.id)
        .map((entry) => entry.identity.id),
    })));

    const apisWithChildren = sortByIdentity(apis.map((api) => ({
      ...api,
      commandIds: commands.filter((entry) => entry.parentApiId === api.identity.id).map((entry) => entry.identity.id),
      queryIds: queries.filter((entry) => entry.parentApiId === api.identity.id).map((entry) => entry.identity.id),
      eventIds: events.filter((entry) => entry.parentApiId === api.identity.id).map((entry) => entry.identity.id),
    })));

    const dbWithChildren = sortByIdentity(databases.map((database) => ({
      ...database,
      schemaIds: schemas.filter((entry) => entry.parentDatabaseId === database.identity.id).map((entry) => entry.identity.id),
    })));

    const schemaWithChildren = sortByIdentity(schemas.map((schema) => ({
      ...schema,
      aggregateIds: aggregates
        .filter((entry) => entry.parentSchemaId === schema.identity.id)
        .map((entry) => entry.identity.id),
    })));

    const aggregatesWithChildren = sortByIdentity(aggregates.map((aggregate) => ({
      ...aggregate,
      entityIds: entityDefinitions
        .filter((entry) => entry.parentAggregateId === aggregate.identity.id)
        .map((entry) => entry.identity.id),
      valueObjectIds: valueObjects
        .filter((entry) => entry.parentAggregateId === aggregate.identity.id)
        .map((entry) => entry.identity.id),
    })));

    const entitiesWithRepositories = sortByIdentity(entityDefinitions.map((entity) => ({
      ...entity,
      repositoryIds: repositories.map((entry) => entry.identity.id),
    })));

    const workflowsWithEvents = sortByIdentity(workflows.map((workflow) => ({
      ...workflow,
      eventIds: events.map((entry) => entry.identity.id),
    })));

    const runtimeWithChildren = sortByIdentity(runtime.map((entry) => ({
      ...entry,
      environmentIds: environments.map((env) => env.identity.id),
      dependencyNodeIds: [],
    })));

    const infrastructureWithChildren = sortByIdentity(infrastructure.map((entry) => ({
      ...entry,
      networkIds: networks.map((network) => network.identity.id),
      storageIds: storage.map((item) => item.identity.id),
      securityIds: security.map((item) => item.identity.id),
    })));

    const environmentsWithChildren = sortByIdentity(environments.map((entry) => ({
      ...entry,
      configurationIds: configurations.map((item) => item.identity.id),
      secretReferenceIds: secretReferences.map((item) => item.identity.id),
    })));

    const nodes: BlueprintDependencyNode[] = [
      ...modulesWithChildren.map((entry) => ({
        id: entry.identity.id,
        type: "module",
        ownerId: entry.parentBoundedContextId,
        domainId: idForName(domainsWithChildren, entry.canonicalName.replace(" Module", "") + " Domain") || domainsWithChildren[0].identity.id,
      })),
      ...appsWithChildren.map((entry) => ({
        id: entry.identity.id,
        type: "application",
        ownerId: entry.parentModuleId,
        domainId: domainsWithChildren[0].identity.id,
      })),
      ...servicesWithChildren.map((entry) => ({
        id: entry.identity.id,
        type: "service",
        ownerId: entry.parentApplicationId,
        domainId: domainsWithChildren[0].identity.id,
      })),
      ...apisWithChildren.map((entry) => ({
        id: entry.identity.id,
        type: "api",
        ownerId: entry.parentServiceId,
        domainId: domainsWithChildren[0].identity.id,
      })),
      ...events.map((entry) => ({
        id: entry.identity.id,
        type: "event",
        ownerId: entry.parentApiId,
        domainId: domainsWithChildren[0].identity.id,
      })),
      ...workflowsWithEvents.map((entry) => ({
        id: entry.identity.id,
        type: "workflow",
        ownerId: entry.parentDomainId,
        domainId: entry.parentDomainId,
      })),
      ...runtimeWithChildren.map((entry) => ({
        id: entry.identity.id,
        type: "runtime",
        ownerId: enterpriseBase.identity.id,
        domainId: domainsWithChildren[0].identity.id,
      })),
      ...deployments.map((entry) => ({
        id: entry.identity.id,
        type: "deployment",
        ownerId: enterpriseBase.identity.id,
        domainId: domainsWithChildren[0].identity.id,
      })),
    ].sort((a, b) => a.id.localeCompare(b.id));

    const edges: BlueprintDependencyEdge[] = [
      ...appsWithChildren.map((entry) => ({ from: entry.parentModuleId, to: entry.identity.id, relation: "contains" })),
      ...servicesWithChildren.map((entry) => ({ from: entry.parentApplicationId, to: entry.identity.id, relation: "hosts" })),
      ...apisWithChildren.map((entry) => ({ from: entry.parentServiceId, to: entry.identity.id, relation: "exposes" })),
      ...events.map((entry) => ({ from: entry.parentApiId, to: entry.identity.id, relation: "emits" })),
      ...workflowsWithEvents.flatMap((entry) => entry.eventIds.map((eventId) => ({ from: entry.identity.id, to: eventId, relation: "consumes" }))),
      ...deployments.map((entry) => ({ from: entry.runtimeIds[0], to: entry.identity.id, relation: "deploys" })),
      ...integrations.map((entry) => ({ from: entry.sourceServiceId, to: entry.targetServiceId, relation: "integrates" })),
    ]
      .filter((edge) => Boolean(edge.from) && Boolean(edge.to))
      .sort((a, b) => `${a.from}|${a.to}|${a.relation}`.localeCompare(`${b.from}|${b.to}|${b.relation}`));

    const nodeIds = new Set(nodes.map((entry) => entry.id));
    const invalidDependencies = edges
      .filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to))
      .map((edge) => `${edge.from}->${edge.to}:${edge.relation}`)
      .sort((a, b) => a.localeCompare(b));

    const missingOwnership = nodes
      .filter((node) => !node.ownerId)
      .map((node) => node.id)
      .sort((a, b) => a.localeCompare(b));

    const crossDomainViolations = edges
      .filter((edge) => {
        const from = nodes.find((node) => node.id === edge.from);
        const to = nodes.find((node) => node.id === edge.to);
        if (!from || !to) {
          return false;
        }

        const isAllowedIntegration = from.type === "service" && to.type === "service" && edge.relation === "integrates";
        return from.domainId !== to.domainId && !isAllowedIntegration;
      })
      .map((edge) => `${edge.from}->${edge.to}`)
      .sort((a, b) => a.localeCompare(b));

    const orphanModules = modulesWithChildren
      .filter((module) => module.applicationIds.length === 0)
      .map((module) => module.identity.id)
      .sort((a, b) => a.localeCompare(b));

    const duplicateServices = uniqueSorted(
      servicesWithChildren
        .map((service) => service.canonicalName.toLowerCase())
        .filter((name, index, all) => all.indexOf(name) !== index),
    );

    const cyclePaths = detectCycle(nodes, edges);

    const dependencyGraph: BlueprintDependencyGraph = {
      nodes,
      edges,
      hasCycle: cyclePaths.length > 0,
      cyclePaths,
      invalidDependencies,
      missingOwnership,
      crossDomainViolations,
      orphanModules,
      duplicateServices,
    };

    const enterprise: EnterpriseDefinition = {
      ...enterpriseBase,
      enterpriseType: "canonical-enterprise",
      domainIds: domainsWithChildren.map((entry) => entry.identity.id),
    };

    const blueprint: EnterpriseBlueprint = {
      version: "1.0.0",
      generatedAt: compiledAt,
      enterprise,
      domains: domainsWithChildren,
      boundedContexts: contextsWithChildren,
      modules: modulesWithChildren,
      applications: appsWithChildren,
      services: servicesWithChildren,
      apis: apisWithChildren,
      databases: dbWithChildren,
      schemas: schemaWithChildren,
      aggregates: aggregatesWithChildren,
      entities: entitiesWithRepositories,
      valueObjects,
      repositories,
      commands,
      queries,
      events,
      workflows: workflowsWithEvents,
      integrations,
      permissions,
      roles: roleDefinitions,
      policies: policyDefinitions,
      runtime: runtimeWithChildren,
      infrastructure: infrastructureWithChildren,
      deployments,
      environments: environmentsWithChildren,
      configurations,
      secretReferences,
      monitoring,
      scheduling,
      messaging,
      storage,
      networks,
      security,
      dependencyGraph,
    };

    const context: BlueprintCompilationContext = {
      compilerVersion,
      pipelineVersion,
      compiledAt,
      sourceBusinessGenomeHash: input.deterministicHash,
      sourceObjectCount:
        genome.entities.length
        + genome.relationships.length
        + genome.capabilities.length
        + genome.processes.length
        + genome.events.length,
      sourceTypes: uniqueSorted(genome.entities.map((entry) => entry.entityType)),
      sourceIds: uniqueSorted(genome.entities.map((entry) => entry.lineage.sourceKnowledgeId)),
      deterministicRunId: `bp-run-${input.deterministicHash.slice(0, 12)}`,
    };

    const provisionalMetrics: BlueprintCompilationMetrics = {
      domainsGenerated: blueprint.domains.length,
      boundedContextsGenerated: blueprint.boundedContexts.length,
      modulesGenerated: blueprint.modules.length,
      applicationsGenerated: blueprint.applications.length,
      servicesGenerated: blueprint.services.length,
      apisGenerated: blueprint.apis.length,
      databasesGenerated: blueprint.databases.length,
      schemasGenerated: blueprint.schemas.length,
      aggregatesGenerated: blueprint.aggregates.length,
      entitiesProjected: blueprint.entities.length,
      workflowsGenerated: blueprint.workflows.length,
      eventsProjected: blueprint.events.length,
      integrationsGenerated: blueprint.integrations.length,
      runtimeDefined: blueprint.runtime.length,
      deploymentsDefined: blueprint.deployments.length,
      validationErrors: 0,
      diagnosticsCount: 0,
      dependencyNodeCount: blueprint.dependencyGraph.nodes.length,
      dependencyEdgeCount: blueprint.dependencyGraph.edges.length,
      executionTimeMs: 0,
    };

    const provisionalIR: EnterpriseBlueprintIR = {
      schemaVersion: "1.0.0",
      enterpriseBlueprint: blueprint,
      compilationContext: context,
      diagnostics,
      metrics: provisionalMetrics,
      deterministicHash: "",
      deterministicSerialization: "",
      compiledFromBusinessGenomeHash: input.deterministicHash,
      generatedAt: compiledAt,
    };

    const deterministicSerialization = this.hasher.serialize(provisionalIR);
    const deterministicHash = this.hasher.hash({ ...provisionalIR, deterministicSerialization });

    const computedIR: EnterpriseBlueprintIR = {
      ...provisionalIR,
      deterministicSerialization,
      deterministicHash,
    };

    diagnostics.push(...this.validator.validate(computedIR));

    const metrics: BlueprintCompilationMetrics = {
      ...provisionalMetrics,
      validationErrors: diagnostics.filter((entry) => entry.severity === "error").length,
      diagnosticsCount: diagnostics.length,
      executionTimeMs: 0,
    };

    const frozen = deepFreeze({
      ...computedIR,
      diagnostics: diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
      metrics,
      deterministicSerialization: this.hasher.serialize({ ...computedIR, diagnostics, metrics }),
    });

    const final = deepFreeze({ ...frozen, deterministicHash: this.hasher.hash(frozen) });

    const result: BlueprintCompilationResult = {
      success: !this.validator.hasBlockingErrors(final.diagnostics),
      enterpriseBlueprintIR: final,
      diagnostics: final.diagnostics,
      metrics: final.metrics,
    };

    if (!result.success) {
      throw new Error(
        `Blueprint compilation failed: ${result.diagnostics
          .filter((entry) => entry.severity === "error")
          .map((entry) => `${entry.code} ${entry.message}`)
          .join("; ")}`,
      );
    }

    return result;
  }
}
