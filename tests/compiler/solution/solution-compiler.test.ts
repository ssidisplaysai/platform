import assert from "node:assert/strict";
import test from "node:test";
import { SolutionCompiler } from "../../../src/compiler/solution/SolutionCompiler";
import type {
  BlueprintObjectBase,
  EnterpriseBlueprint,
  EnterpriseBlueprintIR,
} from "../../../src/compiler/blueprint/BlueprintIR";

function makeBase(id: string, name: string): BlueprintObjectBase {
  return {
    identity: {
      id,
      kind: "blueprint",
      objectType: "blueprint-object",
      enterpriseScope: "enterprise",
      domainScope: "domain",
      moduleScope: "module",
      parentRelationships: [],
      temporalScope: "2026-open",
      lineageSignature: "lineage",
      versionSemantics: "1.0.0",
    },
    semanticType: "blueprint-object",
    canonicalName: name,
    canonicalContent: `${name} content`,
    version: {
      semver: "1.0.0",
      revision: 1,
      compiledAt: "2026-01-01T00:00:00.000Z",
      supersedes: null,
      supersededBy: null,
    },
    provenance: {
      sourceKnowledgeId: `k-${id}`,
      sourceEvidenceId: `e-${id}`,
      sourceEvidenceIdentity: `e-${id}`,
      sourceDocument: "interview.md",
      sourceInterviewId: "int-1",
      sourceType: "markdown",
      sourceOrigin: "interview.md",
      compilerStage: "stage-5-blueprint-compiler",
      transformationVersion: "1.0.0",
      validationResult: "valid",
    },
    lineage: {
      sourceKnowledgeId: `k-${id}`,
      sourceEvidenceIds: [`e-${id}`],
      sourceDocument: "interview.md",
      sourceInterviewId: "int-1",
      compilerStage: "stage-5-blueprint-compiler",
      transformationVersion: "1.0.0",
      validationResult: "valid",
      transformationPath: ["stage-4-business-genome-compiler", "stage-5-blueprint-compiler"],
    },
    confidence: {
      initial: 0.8,
      current: 0.8,
      method: "fixture",
      factors: {},
      rationale: ["fixture"],
    },
    temporalValidity: {
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: null,
      observedAt: "2026-01-01T00:00:00.000Z",
      compiledAt: "2026-01-01T00:00:00.000Z",
      supersedes: null,
      supersededBy: null,
    },
    conflicts: [],
    businessGenomeReferences: ["bg-1"],
    knowledgeReferences: ["k-1"],
    evidenceReferences: ["e-1"],
    compilerStage: "stage-5-blueprint-compiler",
    compilerVersion: "1.0.0",
    validationStatus: "valid",
    diagnosticReferences: [],
    metadata: { domain: "operations" },
  };
}

function buildBlueprint(): EnterpriseBlueprintIR {
  const enterprise = {
    ...makeBase("bp-enterprise", "Enterprise"),
    enterpriseType: "canonical-enterprise",
    domainIds: ["bp-domain"],
  };

  const domain = {
    ...makeBase("bp-domain", "Operations Domain"),
    parentEnterpriseId: enterprise.identity.id,
    boundedContextIds: ["bp-context"],
  };

  const context = {
    ...makeBase("bp-context", "Operations Context"),
    parentDomainId: domain.identity.id,
    moduleIds: ["bp-module"],
  };

  const moduleDef = {
    ...makeBase("bp-module", "Core Module"),
    parentBoundedContextId: context.identity.id,
    applicationIds: ["bp-app"],
  };

  const app = {
    ...makeBase("bp-app", "Operations App"),
    parentModuleId: moduleDef.identity.id,
    serviceIds: ["bp-service"],
  };

  const service = {
    ...makeBase("bp-service", "Operations Service"),
    parentApplicationId: app.identity.id,
    apiIds: ["bp-api"],
    repositoryIds: ["bp-repo"],
  };

  const api = {
    ...makeBase("bp-api", "Operations API"),
    parentServiceId: service.identity.id,
    commandIds: ["bp-command"],
    queryIds: ["bp-query"],
    eventIds: ["bp-event"],
  };

  const database = {
    ...makeBase("bp-db", "Operations DB"),
    parentModuleId: moduleDef.identity.id,
    schemaIds: ["bp-schema"],
  };

  const schema = {
    ...makeBase("bp-schema", "Operations Schema"),
    parentDatabaseId: database.identity.id,
    aggregateIds: ["bp-aggregate"],
  };

  const aggregate = {
    ...makeBase("bp-aggregate", "Operations Aggregate"),
    parentSchemaId: schema.identity.id,
    entityIds: ["bp-entity"],
    valueObjectIds: ["bp-vo"],
  };

  const entity = {
    ...makeBase("bp-entity", "Operations Entity"),
    parentAggregateId: aggregate.identity.id,
    repositoryIds: ["bp-repo"],
  };

  const valueObject = {
    ...makeBase("bp-vo", "Operations VO"),
    parentAggregateId: aggregate.identity.id,
  };

  const repository = {
    ...makeBase("bp-repo", "Operations Repo"),
    parentServiceId: service.identity.id,
    entityIds: [entity.identity.id],
  };

  const command = {
    ...makeBase("bp-command", "Create Command"),
    parentApiId: api.identity.id,
    targetEntityIds: [entity.identity.id],
  };

  const query = {
    ...makeBase("bp-query", "Get Query"),
    parentApiId: api.identity.id,
    targetEntityIds: [entity.identity.id],
  };

  const event = {
    ...makeBase("bp-event", "Created Event"),
    parentApiId: api.identity.id,
    workflowIds: ["bp-workflow"],
  };

  const workflow = {
    ...makeBase("bp-workflow", "Operations Workflow"),
    parentDomainId: domain.identity.id,
    eventIds: [event.identity.id],
    serviceIds: [service.identity.id],
  };

  const integration = {
    ...makeBase("bp-integration", "Operations Integration"),
    sourceServiceId: service.identity.id,
    targetServiceId: service.identity.id,
    integrationType: "service-link",
  };

  const permission = {
    ...makeBase("bp-permission", "Ops Permission"),
    roleIds: ["bp-role"],
    policyIds: ["bp-policy"],
  };

  const role = {
    ...makeBase("bp-role", "Ops Role"),
    permissionIds: [permission.identity.id],
  };

  const policy = {
    ...makeBase("bp-policy", "Ops Policy"),
    permissionIds: [permission.identity.id],
  };

  const runtime = {
    ...makeBase("bp-runtime", "Ops Runtime"),
    environmentIds: ["bp-env"],
    dependencyNodeIds: [],
  };

  const infrastructure = {
    ...makeBase("bp-infra", "Ops Infra"),
    networkIds: ["bp-network"],
    storageIds: ["bp-storage"],
    securityIds: ["bp-security"],
  };

  const deployment = {
    ...makeBase("bp-deploy", "Ops Deploy"),
    environmentIds: ["bp-env"],
    runtimeIds: [runtime.identity.id],
  };

  const environment = {
    ...makeBase("bp-env", "Prod"),
    configurationIds: ["bp-config"],
    secretReferenceIds: ["bp-secret"],
  };

  const configuration = {
    ...makeBase("bp-config", "Runtime Config"),
    environmentId: environment.identity.id,
  };

  const secret = {
    ...makeBase("bp-secret", "Secret Ref"),
    environmentId: environment.identity.id,
  };

  const monitoring = {
    ...makeBase("bp-monitor", "Monitoring"),
    runtimeId: runtime.identity.id,
  };

  const scheduling = {
    ...makeBase("bp-schedule", "Scheduling"),
    runtimeId: runtime.identity.id,
  };

  const messaging = {
    ...makeBase("bp-message", "Messaging"),
    runtimeId: runtime.identity.id,
  };

  const storage = {
    ...makeBase("bp-storage", "Storage"),
    infrastructureId: infrastructure.identity.id,
  };

  const network = {
    ...makeBase("bp-network", "Network"),
    infrastructureId: infrastructure.identity.id,
  };

  const security = {
    ...makeBase("bp-security", "Security"),
    infrastructureId: infrastructure.identity.id,
  };

  const enterpriseBlueprint: EnterpriseBlueprint = {
    version: "1.0.0",
    generatedAt: "2026-01-01T00:00:00.000Z",
    enterprise,
    domains: [domain],
    boundedContexts: [context],
    modules: [moduleDef],
    applications: [app],
    services: [service],
    apis: [api],
    databases: [database],
    schemas: [schema],
    aggregates: [aggregate],
    entities: [entity],
    valueObjects: [valueObject],
    repositories: [repository],
    commands: [command],
    queries: [query],
    events: [event],
    workflows: [workflow],
    integrations: [integration],
    permissions: [permission],
    roles: [role],
    policies: [policy],
    runtime: [runtime],
    infrastructure: [infrastructure],
    deployments: [deployment],
    environments: [environment],
    configurations: [configuration],
    secretReferences: [secret],
    monitoring: [monitoring],
    scheduling: [scheduling],
    messaging: [messaging],
    storage: [storage],
    networks: [network],
    security: [security],
    dependencyGraph: {
      nodes: [
        { id: moduleDef.identity.id, type: "module", ownerId: context.identity.id, domainId: domain.identity.id },
        { id: app.identity.id, type: "application", ownerId: moduleDef.identity.id, domainId: domain.identity.id },
        { id: service.identity.id, type: "service", ownerId: app.identity.id, domainId: domain.identity.id },
        { id: api.identity.id, type: "api", ownerId: service.identity.id, domainId: domain.identity.id },
        { id: runtime.identity.id, type: "runtime", ownerId: enterprise.identity.id, domainId: domain.identity.id },
        { id: deployment.identity.id, type: "deployment", ownerId: enterprise.identity.id, domainId: domain.identity.id },
      ],
      edges: [
        { from: moduleDef.identity.id, to: app.identity.id, relation: "contains" },
        { from: app.identity.id, to: service.identity.id, relation: "hosts" },
        { from: service.identity.id, to: api.identity.id, relation: "exposes" },
        { from: runtime.identity.id, to: deployment.identity.id, relation: "deploys" },
      ],
      hasCycle: false,
      cyclePaths: [],
      invalidDependencies: [],
      missingOwnership: [],
      crossDomainViolations: [],
      orphanModules: [],
      duplicateServices: [],
    },
  };

  return {
    schemaVersion: "1.0.0",
    enterpriseBlueprint,
    compilationContext: {
      compilerVersion: "1.0.0",
      pipelineVersion: "1.0.0",
      compiledAt: "2026-01-01T00:00:00.000Z",
      sourceBusinessGenomeHash: "a".repeat(64),
      sourceObjectCount: 30,
      sourceTypes: ["organization"],
      sourceIds: ["k-1"],
      deterministicRunId: "bp-run-fixture",
    },
    diagnostics: [],
    metrics: {
      domainsGenerated: 1,
      boundedContextsGenerated: 1,
      modulesGenerated: 1,
      applicationsGenerated: 1,
      servicesGenerated: 1,
      apisGenerated: 1,
      databasesGenerated: 1,
      schemasGenerated: 1,
      aggregatesGenerated: 1,
      entitiesProjected: 1,
      workflowsGenerated: 1,
      eventsProjected: 1,
      integrationsGenerated: 1,
      runtimeDefined: 1,
      deploymentsDefined: 1,
      validationErrors: 0,
      diagnosticsCount: 0,
      dependencyNodeCount: 6,
      dependencyEdgeCount: 4,
      executionTimeMs: 0,
    },
    deterministicHash: "b".repeat(64),
    deterministicSerialization: "{}",
    compiledFromBusinessGenomeHash: "a".repeat(64),
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("deterministic compilation and stable identities", () => {
  const compiler = new SolutionCompiler();
  const first = compiler.compile(buildBlueprint());
  const second = compiler.compile(buildBlueprint());

  assert.equal(first.deterministicHash, second.deterministicHash);
  assert.equal(first.deterministicSerialization, second.deterministicSerialization);
  assert.deepEqual(
    first.enterpriseSolution.services.map((entry) => entry.identity.id),
    second.enterpriseSolution.services.map((entry) => entry.identity.id),
  );
});

test("projection coverage across solution categories", () => {
  const compiler = new SolutionCompiler();
  const result = compiler.compile(buildBlueprint());

  assert.equal(result.enterpriseSolution.applications.length > 0, true);
  assert.equal(result.enterpriseSolution.modules.length > 0, true);
  assert.equal(result.enterpriseSolution.services.length > 0, true);
  assert.equal(result.enterpriseSolution.apis.length > 0, true);
  assert.equal(result.enterpriseSolution.databases.length > 0, true);
  assert.equal(result.enterpriseSolution.workflows.length > 0, true);
  assert.equal(result.enterpriseSolution.runtime.length > 0, true);
  assert.equal(result.enterpriseSolution.deployment.length > 0, true);
  assert.equal(result.enterpriseSolution.security.length > 0, true);
  assert.equal(result.enterpriseSolution.monitoring.length > 0, true);
  assert.equal(result.enterpriseSolution.configuration.length > 0, true);
  assert.equal(result.enterpriseSolution.integrations.length > 0, true);
});

test("dependency graph, lineage, provenance and immutability", () => {
  const compiler = new SolutionCompiler();
  const result = compiler.compile(buildBlueprint());

  assert.equal(result.enterpriseSolution.dependencyGraph.nodes.length > 0, true);
  assert.equal(result.enterpriseSolution.dependencyGraph.edges.length > 0, true);
  assert.equal(result.enterpriseSolution.dependencyGraph.hasCycle, false);
  assert.equal(result.enterpriseSolution.services[0].lineage.transformationPath.includes("stage-6-solution-compiler"), true);
  assert.equal(Boolean(result.enterpriseSolution.services[0].provenance.sourceEvidenceIdentity), true);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.enterpriseSolution), true);
  assert.throws(() => {
    (result.enterpriseSolution.services as unknown as unknown[]).push({} as never);
  }, /object is not extensible|read only|frozen/i);
});

test("validation failures block compilation", () => {
  const compiler = new SolutionCompiler();
  const broken = buildBlueprint();
  const duplicateService = {
    ...broken.enterpriseBlueprint.services[0],
    identity: { ...broken.enterpriseBlueprint.services[0].identity, id: "bp-service-dup" },
  };

  const invalidInput: EnterpriseBlueprintIR = {
    ...broken,
    enterpriseBlueprint: {
      ...broken.enterpriseBlueprint,
      services: [broken.enterpriseBlueprint.services[0], duplicateService],
      runtime: [],
    },
  };

  assert.throws(() => compiler.compile(invalidInput), /Solution compilation failed/i);
});
