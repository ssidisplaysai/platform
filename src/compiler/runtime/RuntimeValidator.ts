import { RuntimeIdentityFactory } from "./RuntimeIdentity";
import type {
  EnterpriseRuntime,
  EnterpriseRuntimeIR,
  RuntimeDependencyBinding,
  RuntimeDiagnostic,
  RuntimeExecutionEdge,
  RuntimeExecutionGraph,
  RuntimeExecutionNode,
  RuntimeProviderBinding,
  RuntimeValidationSummary,
} from "./EnterpriseRuntimeIR";

function push(
  diagnostics: RuntimeDiagnostic[],
  entry: Omit<RuntimeDiagnostic, "severity" | "blocking"> & { severity?: RuntimeDiagnostic["severity"]; blocking?: boolean },
): void {
  diagnostics.push({
    severity: entry.severity ?? "error",
    blocking: entry.blocking ?? true,
    ...entry,
  });
}

function duplicateIds(items: readonly { runtimeId?: string; bindingId?: string; nodeId?: string; edgeId?: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = item.runtimeId ?? item.bindingId ?? item.nodeId ?? item.edgeId;
    if (!id) {
      continue;
    }
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id).sort((a, b) => a.localeCompare(b));
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

  const visit = (nodeId: string): void => {
    visiting.add(nodeId);
    path.push(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      if (visiting.has(next)) {
        const cycleStart = path.indexOf(next);
        if (cycleStart >= 0) {
          cycles.add(path.slice(cycleStart).concat(next).join(" -> "));
        }
        continue;
      }
      if (!visited.has(next)) {
        visit(next);
      }
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  };

  for (const node of [...nodes].map((entry) => entry.nodeId).sort((a, b) => a.localeCompare(b))) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return [...cycles].sort((a, b) => a.localeCompare(b));
}

function validateDependencyBindings(
  diagnostics: RuntimeDiagnostic[],
  dependencies: readonly RuntimeDependencyBinding[],
  providers: readonly RuntimeProviderBinding[],
): void {
  const providerContracts = new Map<string, RuntimeProviderBinding[]>();
  for (const provider of providers) {
    providerContracts.set(provider.contract, [...(providerContracts.get(provider.contract) ?? []), provider]);
  }

  const byConsumer = new Map<string, RuntimeDependencyBinding[]>();
  for (const binding of dependencies) {
    byConsumer.set(binding.consumerId, [...(byConsumer.get(binding.consumerId) ?? []), binding]);

    const contractProviders = providerContracts.get(binding.contract) ?? [];
    if (binding.required && contractProviders.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-020",
        category: "provider",
        message: `Missing provider for contract ${binding.contract}`,
        runtimeObjectId: binding.bindingId,
      });
    }

    if (contractProviders.length > 1) {
      push(diagnostics, {
        code: "RUN-VAL-021",
        category: "provider",
        message: `Ambiguous providers for contract ${binding.contract}`,
        runtimeObjectId: binding.bindingId,
      });
    }
  }

  const graph = new Map<string, string[]>();
  for (const binding of dependencies) {
    graph.set(binding.consumerId, [...(graph.get(binding.consumerId) ?? []), binding.providerId]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (id: string): void => {
    visiting.add(id);
    for (const next of graph.get(id) ?? []) {
      if (visiting.has(next)) {
        push(diagnostics, {
          code: "RUN-VAL-022",
          category: "dependency",
          message: `Circular dependency detected for ${id}`,
          runtimeObjectId: id,
        });
        continue;
      }
      if (!visited.has(next)) {
        walk(next);
      }
    }
    visiting.delete(id);
    visited.add(id);
  };

  for (const id of [...graph.keys()].sort((a, b) => a.localeCompare(b))) {
    if (!visited.has(id)) {
      walk(id);
    }
  }

  for (const bindings of byConsumer.values()) {
    const scopes = new Set(bindings.map((entry) => entry.scope));
    if (scopes.size > 1) {
      push(diagnostics, {
        code: "RUN-VAL-023",
        category: "dependency",
        message: "Cross-scope violations detected for dependency consumer",
      });
    }
  }
}

function validateExecutionGraph(diagnostics: RuntimeDiagnostic[], graph: RuntimeExecutionGraph): void {
  const nodeIds = new Set(graph.nodes.map((entry) => entry.nodeId));
  const duplicateNodes = duplicateIds(graph.nodes);
  for (const duplicate of duplicateNodes) {
    push(diagnostics, {
      code: "RUN-VAL-011",
      category: "validation",
      message: `Duplicate graph node ${duplicate}`,
      runtimeObjectId: duplicate,
    });
  }

  const duplicateEdges = duplicateIds(graph.edges);
  for (const duplicate of duplicateEdges) {
    push(diagnostics, {
      code: "RUN-VAL-012",
      category: "validation",
      message: `Duplicate graph edge ${duplicate}`,
      runtimeObjectId: duplicate,
    });
  }

  const invalidEdges = graph.edges.filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to));
  if (invalidEdges.length > 0) {
    push(diagnostics, {
      code: "RUN-VAL-035",
      category: "validation",
      message: "Graph integrity violations detected",
      cause: invalidEdges.map((entry) => `${entry.edgeId}:${entry.from}->${entry.to}`).join(", "),
    });
  }

  const cycles = detectCycles(graph.nodes, graph.edges);
  if (cycles.length > 0 || graph.hasCycle) {
    push(diagnostics, {
      code: "RUN-VAL-018",
      category: "validation",
      message: "Execution graph has activation cycles",
      cause: cycles.join(" | "),
    });
  }

  if (graph.orphanNodeIds.length > 0) {
    push(diagnostics, {
      code: "RUN-VAL-019",
      category: "validation",
      message: "Execution graph contains orphan nodes",
      cause: graph.orphanNodeIds.join(","),
    });
  }
}

function validateOrdering(diagnostics: RuntimeDiagnostic[], runtime: EnterpriseRuntime): void {
  const sortableCollections: Array<{ name: string; values: readonly string[] }> = [
    { name: "modules", values: runtime.modules.map((entry) => entry.runtimeId) },
    { name: "applications", values: runtime.applications.map((entry) => entry.runtimeId) },
    { name: "services", values: runtime.services.map((entry) => entry.runtimeId) },
    { name: "apis", values: runtime.apis.map((entry) => entry.runtimeId) },
  ];

  for (const collection of sortableCollections) {
    const sorted = [...collection.values].sort((a, b) => a.localeCompare(b));
    if (collection.values.join("|") !== sorted.join("|")) {
      push(diagnostics, {
        code: "RUN-VAL-033",
        category: "determinism",
        message: `Unstable ordering in ${collection.name}`,
      });
    }
  }
}

export class RuntimeValidator {
  validate(ir: EnterpriseRuntimeIR): readonly RuntimeDiagnostic[] {
    const diagnostics: RuntimeDiagnostic[] = [];

    if (!ir.enterpriseRuntime) {
      push(diagnostics, {
        code: "RUN-VAL-001",
        category: "validation",
        message: "Missing runtime root",
      });
      return diagnostics;
    }

    const runtime = ir.enterpriseRuntime;

    if (!runtime.solutionId) {
      push(diagnostics, {
        code: "RUN-VAL-002",
        category: "identity",
        message: "Missing solution identity",
      });
    }

    if (!runtime.enterpriseId) {
      push(diagnostics, {
        code: "RUN-VAL-003",
        category: "identity",
        message: "Missing enterprise identity",
      });
    }

    if (!runtime.activationPlan || runtime.activationPlan.phases.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-004",
        category: "validation",
        message: "Missing activation plan",
      });
    }

    if (!runtime.shutdownPlan || runtime.shutdownPlan.orderedSteps.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-005",
        category: "validation",
        message: "Missing shutdown plan",
      });
    }

    if (!runtime.recoveryPlan || runtime.recoveryPlan.orderedSteps.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-006",
        category: "validation",
        message: "Missing recovery plan",
      });
    }

    if (!runtime.executionGraph) {
      push(diagnostics, {
        code: "RUN-VAL-007",
        category: "validation",
        message: "Missing execution graph",
      });
    }

    if (!RuntimeIdentityFactory.isValid(runtime.runtimeId)) {
      push(diagnostics, {
        code: "RUN-VAL-008",
        category: "identity",
        message: "Invalid runtime identity",
        runtimeObjectId: runtime.runtimeId,
      });
    }

    const duplicateChecks: Array<{ values: readonly { runtimeId?: string; bindingId?: string }[]; code: string; label: string }> = [
      { values: runtime.modules, code: "RUN-VAL-009", label: "modules" },
      { values: runtime.applications, code: "RUN-VAL-010", label: "applications" },
      { values: runtime.services, code: "RUN-VAL-013", label: "services" },
      { values: runtime.apis, code: "RUN-VAL-014", label: "apis" },
      { values: runtime.dependencyBindings, code: "RUN-VAL-015", label: "bindings" },
    ];

    for (const check of duplicateChecks) {
      for (const duplicate of duplicateIds(check.values)) {
        push(diagnostics, {
          code: check.code,
          category: "validation",
          message: `Duplicate ${check.label} entry ${duplicate}`,
          runtimeObjectId: duplicate,
        });
      }
    }

    validateDependencyBindings(diagnostics, runtime.dependencyBindings, runtime.providerBindings);
    validateExecutionGraph(diagnostics, runtime.executionGraph);
    validateOrdering(diagnostics, runtime);

    if (runtime.deploymentTargets.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-024",
        category: "deployment",
        message: "Missing deployment targets",
      });
    }

    if (runtime.environments.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-025",
        category: "environment",
        message: "Missing environments",
      });
    }

    if (runtime.healthChecks.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-028",
        category: "health",
        message: "Missing health checks for required services",
      });
    }

    if (runtime.monitoringBindings.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-029",
        category: "monitoring",
        message: "Missing monitoring for required services",
      });
    }

    if (runtime.authenticationBindings.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-030",
        category: "security",
        message: "Missing authentication bindings",
      });
    }

    if (runtime.authorizationBindings.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-031",
        category: "security",
        message: "Missing authorization bindings",
      });
    }

    if (runtime.configurationBindings.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-032",
        category: "configuration",
        message: "Missing configuration references",
      });
    }

    if (ir.deterministicSerialization.length === 0 || ir.deterministicHash.length !== 64) {
      push(diagnostics, {
        code: "RUN-VAL-034",
        category: "determinism",
        message: "Nondeterministic serialization metadata",
      });
    }

    if (runtime.temporalValidity.validTo && runtime.temporalValidity.validTo < runtime.temporalValidity.validFrom) {
      push(diagnostics, {
        code: "RUN-VAL-036",
        category: "validation",
        message: "Temporal validity window is invalid",
      });
    }

    if (!runtime.lineage.sourceKnowledgeId) {
      push(diagnostics, {
        code: "RUN-VAL-037",
        category: "lineage",
        message: "Missing lineage",
      });
    }

    if (!runtime.provenance.sourceKnowledgeId) {
      push(diagnostics, {
        code: "RUN-VAL-038",
        category: "provenance",
        message: "Missing provenance",
      });
    }

    if (runtime.confidence.current < 0 || runtime.confidence.current > 1) {
      push(diagnostics, {
        code: "RUN-VAL-039",
        category: "validation",
        message: "Missing confidence",
      });
    }

    if (diagnostics.length === 0) {
      push(diagnostics, {
        code: "RUN-VAL-000",
        severity: "warning",
        category: "validation",
        message: "Runtime validation completed with no blocking diagnostics",
        blocking: false,
      });
    }

    return diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  }

  hasBlockingErrors(diagnostics: readonly RuntimeDiagnostic[]): boolean {
    return diagnostics.some((entry) => entry.blocking && entry.severity === "error");
  }

  summarize(diagnostics: readonly RuntimeDiagnostic[]): RuntimeValidationSummary {
    return {
      passed: diagnostics.every((entry) => !(entry.blocking && entry.severity === "error")),
      blockingErrorCount: diagnostics.filter((entry) => entry.blocking && entry.severity === "error").length,
      warningCount: diagnostics.filter((entry) => entry.severity === "warning").length,
      diagnosticsCount: diagnostics.length,
    };
  }
}
