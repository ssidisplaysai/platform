import type {
  BlueprintDependencyGraph,
  BlueprintDiagnostic,
  BlueprintObjectBase,
  EnterpriseBlueprint,
  EnterpriseBlueprintIR,
} from "./BlueprintIR";
import { BlueprintIdentityFactory } from "./BlueprintIdentity";

function pushError(diagnostics: BlueprintDiagnostic[], code: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  diagnostics.push({ code, severity: "error", message, context });
}

function pushWarning(diagnostics: BlueprintDiagnostic[], code: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  diagnostics.push({ code, severity: "warning", message, context });
}

function isSorted(ids: readonly string[]): boolean {
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  return ids.every((value, index) => value === sorted[index]);
}

function validateObjects(
  diagnostics: BlueprintDiagnostic[],
  objects: readonly BlueprintObjectBase[],
  objectType: string,
): void {
  for (const object of objects) {
    if (!BlueprintIdentityFactory.isValid(object.identity.id)) {
      pushError(diagnostics, "BP-VAL-017", `Invalid identity in ${objectType}`, { objectId: object.identity.id });
    }

    if (!object.provenance.sourceKnowledgeId || !object.provenance.sourceEvidenceIdentity) {
      pushError(diagnostics, "BP-VAL-014", `Missing provenance in ${objectType}`, { objectId: object.identity.id });
    }

    if (!object.lineage.sourceKnowledgeId || object.lineage.transformationPath.length === 0) {
      pushError(diagnostics, "BP-VAL-013", `Missing lineage in ${objectType}`, { objectId: object.identity.id });
    }

    if (object.temporalValidity.validTo && object.temporalValidity.validTo < object.temporalValidity.validFrom) {
      pushError(diagnostics, "BP-VAL-016", `Invalid temporal validity in ${objectType}`, { objectId: object.identity.id });
    }

    if (object.confidence.current < 0 || object.confidence.current > 1) {
      pushError(diagnostics, "BP-VAL-015", `Missing confidence in ${objectType}`, { objectId: object.identity.id });
    }
  }

  const ids = objects.map((entry) => entry.identity.id);
  if (!isSorted(ids)) {
    pushError(diagnostics, "BP-VAL-018", `Nondeterministic ordering in ${objectType}`);
  }
}

function validateDependencyGraph(diagnostics: BlueprintDiagnostic[], graph: BlueprintDependencyGraph): void {
  if (graph.hasCycle || graph.cyclePaths.length > 0) {
    pushError(diagnostics, "BP-VAL-011", "Circular dependencies detected", { cycles: graph.cyclePaths });
  }

  if (graph.invalidDependencies.length > 0) {
    pushError(diagnostics, "BP-VAL-010", "Broken dependency graph", { invalidDependencies: graph.invalidDependencies });
  }

  if (graph.missingOwnership.length > 0) {
    pushError(diagnostics, "BP-VAL-009", "Missing ownership in dependency graph", { missingOwnership: graph.missingOwnership });
  }

  if (graph.crossDomainViolations.length > 0) {
    pushError(diagnostics, "BP-VAL-019", "Cross-domain dependency violations detected", {
      crossDomainViolations: graph.crossDomainViolations,
    });
  }

  if (graph.orphanModules.length > 0) {
    pushError(diagnostics, "BP-VAL-020", "Orphan modules detected", { orphanModules: graph.orphanModules });
  }

  if (graph.duplicateServices.length > 0) {
    pushError(diagnostics, "BP-VAL-021", "Duplicate services detected", { duplicateServices: graph.duplicateServices });
  }
}

export class BlueprintValidator {
  validate(ir: EnterpriseBlueprintIR): readonly BlueprintDiagnostic[] {
    const diagnostics: BlueprintDiagnostic[] = [];
    const bp = ir.enterpriseBlueprint;

    if (!bp.enterprise) {
      pushError(diagnostics, "BP-VAL-001", "Missing enterprise definition");
    }

    if (bp.domains.length === 0) {
      pushError(diagnostics, "BP-VAL-002", "Missing domains");
    }

    if (bp.boundedContexts.length === 0) {
      pushError(diagnostics, "BP-VAL-003", "Missing bounded contexts");
    }

    if (bp.runtime.length === 0) {
      pushError(diagnostics, "BP-VAL-012", "Missing runtime");
    }

    if (bp.deployments.length === 0) {
      pushError(diagnostics, "BP-VAL-022", "Missing deployment");
    }

    validateObjects(diagnostics, [bp.enterprise], "enterprise");
    validateObjects(diagnostics, bp.domains, "domains");
    validateObjects(diagnostics, bp.boundedContexts, "boundedContexts");
    validateObjects(diagnostics, bp.modules, "modules");
    validateObjects(diagnostics, bp.applications, "applications");
    validateObjects(diagnostics, bp.services, "services");
    validateObjects(diagnostics, bp.apis, "apis");
    validateObjects(diagnostics, bp.databases, "databases");
    validateObjects(diagnostics, bp.schemas, "schemas");
    validateObjects(diagnostics, bp.aggregates, "aggregates");
    validateObjects(diagnostics, bp.entities, "entities");
    validateObjects(diagnostics, bp.valueObjects, "valueObjects");
    validateObjects(diagnostics, bp.repositories, "repositories");
    validateObjects(diagnostics, bp.commands, "commands");
    validateObjects(diagnostics, bp.queries, "queries");
    validateObjects(diagnostics, bp.events, "events");
    validateObjects(diagnostics, bp.workflows, "workflows");
    validateObjects(diagnostics, bp.integrations, "integrations");
    validateObjects(diagnostics, bp.permissions, "permissions");
    validateObjects(diagnostics, bp.roles, "roles");
    validateObjects(diagnostics, bp.policies, "policies");
    validateObjects(diagnostics, bp.runtime, "runtime");
    validateObjects(diagnostics, bp.infrastructure, "infrastructure");
    validateObjects(diagnostics, bp.deployments, "deployments");
    validateObjects(diagnostics, bp.environments, "environments");
    validateObjects(diagnostics, bp.configurations, "configurations");
    validateObjects(diagnostics, bp.secretReferences, "secretReferences");
    validateObjects(diagnostics, bp.monitoring, "monitoring");
    validateObjects(diagnostics, bp.scheduling, "scheduling");
    validateObjects(diagnostics, bp.messaging, "messaging");
    validateObjects(diagnostics, bp.storage, "storage");
    validateObjects(diagnostics, bp.networks, "networks");
    validateObjects(diagnostics, bp.security, "security");

    const duplicateByName = (values: readonly BlueprintObjectBase[], label: string, code: string) => {
      const seen = new Set<string>();
      for (const value of values) {
        const key = value.canonicalName.toLowerCase();
        if (seen.has(key)) {
          pushError(diagnostics, code, `Duplicate ${label} detected`, { canonicalName: value.canonicalName });
        }
        seen.add(key);
      }
    };

    duplicateByName(bp.modules, "modules", "BP-VAL-004");
    duplicateByName(bp.services, "services", "BP-VAL-005");
    duplicateByName(bp.apis, "apis", "BP-VAL-006");
    duplicateByName(bp.workflows, "workflows", "BP-VAL-007");
    duplicateByName(bp.events, "events", "BP-VAL-008");

    validateDependencyGraph(diagnostics, bp.dependencyGraph);

    if (ir.deterministicHash.length !== 64) {
      pushError(diagnostics, "BP-VAL-023", "Serialization determinism hash malformed");
    }

    if (diagnostics.length === 0) {
      pushWarning(diagnostics, "BP-VAL-000", "Blueprint validation completed with no blocking errors");
    }

    return diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  }

  hasBlockingErrors(diagnostics: readonly BlueprintDiagnostic[]): boolean {
    return diagnostics.some((entry) => entry.severity === "error");
  }

  validateBlueprintOnly(enterpriseBlueprint: EnterpriseBlueprint): readonly BlueprintDiagnostic[] {
    const ir: EnterpriseBlueprintIR = {
      schemaVersion: "1.0.0",
      enterpriseBlueprint,
      compilationContext: {
        compilerVersion: "1.0.0",
        pipelineVersion: "1.0.0",
        compiledAt: enterpriseBlueprint.generatedAt,
        sourceBusinessGenomeHash: "unknown",
        sourceObjectCount: 0,
        sourceTypes: [],
        sourceIds: [],
        deterministicRunId: "blueprint-validation-only",
      },
      diagnostics: [],
      metrics: {
        domainsGenerated: enterpriseBlueprint.domains.length,
        boundedContextsGenerated: enterpriseBlueprint.boundedContexts.length,
        modulesGenerated: enterpriseBlueprint.modules.length,
        applicationsGenerated: enterpriseBlueprint.applications.length,
        servicesGenerated: enterpriseBlueprint.services.length,
        apisGenerated: enterpriseBlueprint.apis.length,
        databasesGenerated: enterpriseBlueprint.databases.length,
        schemasGenerated: enterpriseBlueprint.schemas.length,
        aggregatesGenerated: enterpriseBlueprint.aggregates.length,
        entitiesProjected: enterpriseBlueprint.entities.length,
        workflowsGenerated: enterpriseBlueprint.workflows.length,
        eventsProjected: enterpriseBlueprint.events.length,
        integrationsGenerated: enterpriseBlueprint.integrations.length,
        runtimeDefined: enterpriseBlueprint.runtime.length,
        deploymentsDefined: enterpriseBlueprint.deployments.length,
        validationErrors: 0,
        diagnosticsCount: 0,
        dependencyNodeCount: enterpriseBlueprint.dependencyGraph.nodes.length,
        dependencyEdgeCount: enterpriseBlueprint.dependencyGraph.edges.length,
        executionTimeMs: 0,
      },
      deterministicHash: "0".repeat(64),
      deterministicSerialization: "{}",
      compiledFromBusinessGenomeHash: "unknown",
      generatedAt: enterpriseBlueprint.generatedAt,
    };

    return this.validate(ir);
  }
}
