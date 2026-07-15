import { CompilerExecutionPlan } from "./CompilerExecutionPlan";
import type { CompilerDiagnostic, CompilerPass, CompilerPassKind, CompilerPassLifecycle, CompilerPassMetadata } from "./types";

function deterministicTopologicalSort(passes: readonly CompilerPass<unknown, unknown>[]): CompilerPass<unknown, unknown>[] {
  const byId = new Map<string, CompilerPass<unknown, unknown>>();
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const pass of passes) {
    byId.set(pass.metadata.id, pass);
    inDegree.set(pass.metadata.id, 0);
    outgoing.set(pass.metadata.id, []);
  }

  for (const pass of passes) {
    for (const dependency of pass.metadata.dependencies) {
      if (!byId.has(dependency)) {
        throw new Error(`Pass ${pass.metadata.id} has unresolved dependency: ${dependency}`);
      }

      inDegree.set(pass.metadata.id, (inDegree.get(pass.metadata.id) ?? 0) + 1);
      outgoing.get(dependency)?.push(pass.metadata.id);
    }
  }

  const queue = [...inDegree.entries()]
    .filter(([, value]) => value === 0)
    .map(([id]) => id)
    .sort();

  const ordered: CompilerPass<unknown, unknown>[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      break;
    }

    const pass = byId.get(id);
    if (pass) {
      ordered.push(pass);
    }

    for (const nextId of [...(outgoing.get(id) ?? [])].sort()) {
      const degree = (inDegree.get(nextId) ?? 0) - 1;
      inDegree.set(nextId, degree);
      if (degree === 0) {
        queue.push(nextId);
        queue.sort();
      }
    }
  }

  if (ordered.length !== passes.length) {
    throw new Error("Cycle detected in compiler pass dependencies");
  }

  return ordered;
}

export class CompilerPassRegistry {
  private readonly passes = new Map<string, CompilerPass<unknown, unknown>>();

  register(pass: CompilerPass<unknown, unknown>): void {
    if (this.passes.has(pass.metadata.id)) {
      throw new Error(`Pass already registered: ${pass.metadata.id}`);
    }

    this.passes.set(pass.metadata.id, pass);
  }

  list(): CompilerPassMetadata[] {
    return [...this.passes.values()]
      .map((pass) => pass.metadata)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  resolve(passId: string): CompilerPass<unknown, unknown> {
    const pass = this.passes.get(passId);
    if (!pass) {
      throw new Error(`Pass not found: ${passId}`);
    }

    return pass;
  }

  discoverByCapability(capability: string): CompilerPassMetadata[] {
    return this.list().filter((metadata) => metadata.capabilities.includes(capability));
  }

  getOrderedPasses(): readonly CompilerPass<unknown, unknown>[] {
    return deterministicTopologicalSort(this.list().map((metadata) => this.resolve(metadata.id)));
  }

  createExecutionPlan(pipelineVersion: string): CompilerExecutionPlan {
    const steps = this.getOrderedPasses().map((pass, index) =>
      CompilerExecutionPlan.createStep(
        pass.metadata.id,
        index,
        pass.metadata.dependencies,
        pass.metadata.kind ?? inferKind(pass.metadata.id),
      ),
    );

    return new CompilerExecutionPlan(steps, pipelineVersion);
  }

  validate(): readonly CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];
    const ids = new Set<string>();

    for (const metadata of this.list()) {
      if (ids.has(metadata.id)) {
        diagnostics.push({
          code: "DUPLICATE_PASS_ID",
          severity: "error",
          message: `Duplicate pass id: ${metadata.id}`,
          category: "configuration",
          passId: metadata.id,
        });
      }

      ids.add(metadata.id);

      for (const dependency of metadata.dependencies) {
        if (!this.passes.has(dependency)) {
          diagnostics.push({
            code: "MISSING_PASS_DEPENDENCY",
            severity: "error",
            message: `Pass ${metadata.id} depends on missing pass ${dependency}`,
            category: "dependency",
            passId: metadata.id,
          });
        }
      }
    }

    try {
      this.getOrderedPasses();
    } catch (error) {
      diagnostics.push({
        code: "CYCLIC_PASS_DEPENDENCY",
        severity: "error",
        message: error instanceof Error ? error.message : String(error),
        category: "dependency",
      });
    }

    return diagnostics;
  }

  deprecate(passId: string): void {
    this.setLifecycle(passId, "deprecated");
  }

  replace(passId: string, replacementPassId: string): void {
    this.setLifecycle(passId, "replaced", replacementPassId);
  }

  private setLifecycle(passId: string, lifecycle: CompilerPassLifecycle, replacedBy?: string): void {
    const pass = this.resolve(passId);
    const metadata = pass.metadata;

    (metadata as { lifecycle: CompilerPassLifecycle }).lifecycle = lifecycle;
    if (replacedBy) {
      (metadata as { replacedBy?: string }).replacedBy = replacedBy;
    }
  }
}

function inferKind(passId: string): CompilerPassKind {
  if (passId.includes("validation")) {
    return "validation";
  }
  if (passId.includes("verification")) {
    return "verification";
  }
  if (passId.includes("generation") || passId.includes("publish")) {
    return "generation";
  }
  if (passId.includes("packaging")) {
    return "packaging";
  }
  if (passId.includes("certification")) {
    return "certification";
  }

  return "execution";
}
