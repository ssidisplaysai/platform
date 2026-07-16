import type { EnterpriseRuntimeIR } from "../../compiler/runtime/EnterpriseRuntimeIR";
import type { RuntimeDependencyGraph, RuntimeKernelDiagnostic, RuntimeValidationResult } from "./types";

function detectGraphCycle(graph: RuntimeDependencyGraph): boolean {
  const outgoing = new Map<string, string[]>();
  for (const node of graph.nodes) {
    outgoing.set(node, []);
  }
  for (const edge of graph.edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const walk = (node: string): boolean => {
    if (visiting.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }

    visiting.add(node);
    for (const next of outgoing.get(node) ?? []) {
      if (walk(next)) {
        return true;
      }
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  for (const node of [...graph.nodes].sort((a, b) => a.localeCompare(b))) {
    if (walk(node)) {
      return true;
    }
  }

  return false;
}

export class RuntimeKernelValidator {
  validate(input: EnterpriseRuntimeIR, graph: RuntimeDependencyGraph): RuntimeValidationResult {
    const diagnostics: RuntimeKernelDiagnostic[] = [];

    if (!input) {
      diagnostics.push({
        code: "GRT-VAL-001",
        severity: "Critical",
        category: "Validation",
        message: "Missing runtime IR",
        blocking: true,
      });
      return { diagnostics, valid: false };
    }

    const runtime = input.enterpriseRuntime;
    if (!runtime.modules.length) {
      diagnostics.push({
        code: "GRT-VAL-002",
        severity: "Critical",
        category: "Module",
        message: "Missing modules",
        blocking: true,
      });
    }

    if (!runtime.pluginBindings.length) {
      diagnostics.push({
        code: "GRT-VAL-003",
        severity: "Error",
        category: "Plugin",
        message: "Missing plugins",
        blocking: true,
      });
    }

    if (!runtime.workflowBindings.length) {
      diagnostics.push({
        code: "GRT-VAL-004",
        severity: "Error",
        category: "Workflow",
        message: "Missing workflows",
        blocking: true,
      });
    }

    const serviceIds = runtime.services.map((entry) => entry.runtimeId);
    const duplicateService = serviceIds.find((id, index) => serviceIds.indexOf(id) !== index);
    if (duplicateService) {
      diagnostics.push({
        code: "GRT-VAL-005",
        severity: "Critical",
        category: "Service",
        message: `Duplicate services detected: ${duplicateService}`,
        blocking: true,
      });
    }

    if (detectGraphCycle(graph)) {
      diagnostics.push({
        code: "GRT-VAL-006",
        severity: "Critical",
        category: "Dependency",
        message: "Dependency graph cycle detected",
        blocking: true,
      });
    }

    if (graph.hasCycle) {
      diagnostics.push({
        code: "GRT-VAL-007",
        severity: "Critical",
        category: "Dependency",
        message: "Runtime graph marked as cyclic",
        blocking: true,
      });
    }

    if (!runtime.configurationBindings.length) {
      diagnostics.push({
        code: "GRT-VAL-008",
        severity: "Error",
        category: "Configuration",
        message: "Configuration errors: no runtime configuration bindings",
        blocking: true,
      });
    }

    return {
      diagnostics: diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
      valid: diagnostics.every((entry) => !entry.blocking),
    };
  }
}
