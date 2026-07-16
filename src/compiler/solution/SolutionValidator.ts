import { SolutionIdentityFactory } from "./SolutionIdentity";
import type {
  EnterpriseSolution,
  SolutionDiagnostic,
  SolutionIR,
  SolutionObjectBase,
} from "./SolutionIR";

function pushError(diagnostics: SolutionDiagnostic[], code: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  diagnostics.push({ code, severity: "error", message, context });
}

function pushWarning(diagnostics: SolutionDiagnostic[], code: string, message: string, context?: Readonly<Record<string, unknown>>): void {
  diagnostics.push({ code, severity: "warning", message, context });
}

function validateObjects(diagnostics: SolutionDiagnostic[], objects: readonly SolutionObjectBase[], label: string): void {
  for (const object of objects) {
    if (!SolutionIdentityFactory.isValid(object.identity.id)) {
      pushError(diagnostics, "SOL-VAL-015", `Identity violation in ${label}`, { objectId: object.identity.id });
    }

    if (!object.ownerId) {
      pushError(diagnostics, "SOL-VAL-011", `Missing ownership in ${label}`, { objectId: object.identity.id });
    }

    if (!object.lineage.sourceKnowledgeId || object.lineage.transformationPath.length === 0) {
      pushError(diagnostics, "SOL-VAL-013", `Invalid lineage in ${label}`, { objectId: object.identity.id });
    }

    if (!object.provenance.sourceKnowledgeId || !object.provenance.sourceEvidenceIdentity) {
      pushError(diagnostics, "SOL-VAL-014", `Invalid provenance in ${label}`, { objectId: object.identity.id });
    }

    if (object.confidence.current < 0 || object.confidence.current > 1) {
      pushError(diagnostics, "SOL-VAL-017", `Confidence violation in ${label}`, { objectId: object.identity.id });
    }
  }
}

function detectDuplicates(diagnostics: SolutionDiagnostic[], objects: readonly SolutionObjectBase[], label: string, code: string): void {
  const names = new Set<string>();
  for (const object of objects) {
    const key = object.name.toLowerCase();
    if (names.has(key)) {
      pushError(diagnostics, code, `Duplicate ${label} detected`, { name: object.name });
    }
    names.add(key);
  }
}

function validateGraph(diagnostics: SolutionDiagnostic[], ir: SolutionIR): void {
  const graph = ir.enterpriseSolution.dependencyGraph;
  if (graph.hasCycle || graph.cyclePaths.length > 0) {
    pushError(diagnostics, "SOL-VAL-020", "Cyclic dependencies detected", { cyclePaths: graph.cyclePaths });
  }

  if (graph.violations.length > 0) {
    pushError(diagnostics, "SOL-VAL-019", "Dependency graph violations detected", { violations: graph.violations });
  }
}

export class SolutionValidator {
  validate(ir: SolutionIR): readonly SolutionDiagnostic[] {
    const diagnostics: SolutionDiagnostic[] = [];
    const solution = ir.enterpriseSolution;

    if (solution.runtime.length === 0) {
      pushError(diagnostics, "SOL-VAL-009", "Missing runtime");
    }

    if (solution.deployment.length === 0) {
      pushError(diagnostics, "SOL-VAL-010", "Missing deployment");
    }

    detectDuplicates(diagnostics, solution.applications, "applications", "SOL-VAL-001");
    detectDuplicates(diagnostics, solution.services, "services", "SOL-VAL-002");
    detectDuplicates(diagnostics, solution.apis, "apis", "SOL-VAL-003");
    detectDuplicates(diagnostics, solution.runtime, "runtimes", "SOL-VAL-004");
    detectDuplicates(diagnostics, solution.deployment, "deployments", "SOL-VAL-005");
    detectDuplicates(diagnostics, solution.workflows, "workflows", "SOL-VAL-006");
    detectDuplicates(diagnostics, solution.modules, "modules", "SOL-VAL-007");
    detectDuplicates(diagnostics, solution.integrations, "integrations", "SOL-VAL-008");

    validateObjects(diagnostics, solution.modules, "modules");
    validateObjects(diagnostics, solution.applications, "applications");
    validateObjects(diagnostics, solution.services, "services");
    validateObjects(diagnostics, solution.apis, "apis");
    validateObjects(diagnostics, solution.databases, "databases");
    validateObjects(diagnostics, solution.workflows, "workflows");
    validateObjects(diagnostics, solution.integrations, "integrations");
    validateObjects(diagnostics, solution.runtime, "runtime");
    validateObjects(diagnostics, solution.deployment, "deployment");
    validateObjects(diagnostics, solution.security, "security");
    validateObjects(diagnostics, solution.monitoring, "monitoring");
    validateObjects(diagnostics, solution.configuration, "configuration");

    const appIds = new Set(solution.applications.map((entry) => entry.identity.id));
    for (const service of solution.services) {
      if (!appIds.has(service.applicationId)) {
        pushError(diagnostics, "SOL-VAL-012", "Invalid hierarchy: service missing application owner", {
          serviceId: service.identity.id,
          applicationId: service.applicationId,
        });
      }
    }

    const serviceIds = new Set(solution.services.map((entry) => entry.identity.id));
    for (const api of solution.apis) {
      if (!serviceIds.has(api.serviceId)) {
        pushError(diagnostics, "SOL-VAL-016", "Broken references: API missing service", {
          apiId: api.identity.id,
          serviceId: api.serviceId,
        });
      }
    }

    validateGraph(diagnostics, ir);

    if (ir.deterministicHash.length !== 64) {
      pushError(diagnostics, "SOL-VAL-018", "Deterministic hash malformed");
    }

    if (diagnostics.length === 0) {
      pushWarning(diagnostics, "SOL-VAL-000", "Solution validation completed with no blocking errors");
    }

    return diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  }

  hasBlockingErrors(diagnostics: readonly SolutionDiagnostic[]): boolean {
    return diagnostics.some((entry) => entry.severity === "error");
  }

  summarize(solution: EnterpriseSolution, diagnostics: readonly SolutionDiagnostic[]) {
    return {
      passed: diagnostics.every((entry) => entry.severity !== "error"),
      blockingErrorCount: diagnostics.filter((entry) => entry.severity === "error").length,
      warningCount: diagnostics.filter((entry) => entry.severity === "warning").length,
      objectCount:
        solution.modules.length
        + solution.applications.length
        + solution.services.length
        + solution.apis.length
        + solution.runtime.length
        + solution.deployment.length,
    };
  }
}
