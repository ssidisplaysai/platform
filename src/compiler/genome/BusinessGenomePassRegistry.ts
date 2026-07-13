import { CompilerPassRegistry } from "../core/CompilerPassRegistry";
import type { CompilerPass } from "../core/types";
import { CanonicalVerificationPass } from "./passes/CanonicalVerificationPass";
import { EvidenceCorrelationPass } from "./passes/EvidenceCorrelationPass";
import { EvidenceGroupingPass } from "./passes/EvidenceGroupingPass";
import { InputValidationPass } from "./passes/InputValidationPass";
import { SemanticResolutionPass } from "./passes/SemanticResolutionPass";
import { SemanticConsolidationPass } from "./passes/SemanticConsolidationPass";
import { SemanticRelationshipResolutionPass } from "./passes/SemanticRelationshipResolutionPass";
import { SemanticIdentityAssignmentPass } from "./passes/SemanticIdentityAssignmentPass";
import { GraphConstructionPass } from "./passes/GraphConstructionPass";
import { BGC_ARCHITECTURAL_PASS_ORDER } from "./pipeline-types";

function deterministicTopologicalSort(passes: CompilerPass<unknown, unknown>[]): CompilerPass<unknown, unknown>[] {
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
    throw new Error("Cycle detected in Business Genome pass dependencies");
  }

  return ordered;
}

export class BusinessGenomePassRegistry {
  private readonly registry = new CompilerPassRegistry();

  constructor() {
    this.registerDefaultPasses();
    this.validateStructure();
  }

  register(pass: CompilerPass<unknown, unknown>): void {
    this.registry.register(pass);
  }

  resolve(passId: string): CompilerPass<unknown, unknown> {
    return this.registry.resolve(passId);
  }

  list() {
    return this.registry.list();
  }

  executablePassOrder(): CompilerPass<unknown, unknown>[] {
    return deterministicTopologicalSort(this.list().map((entry) => this.resolve(entry.id)));
  }

  plannedPassOrder(): readonly string[] {
    return BGC_ARCHITECTURAL_PASS_ORDER;
  }

  private registerDefaultPasses(): void {
    this.register(new InputValidationPass());
    this.register(new CanonicalVerificationPass());
    this.register(new EvidenceGroupingPass());
    this.register(new EvidenceCorrelationPass());
    this.register(new SemanticResolutionPass());
    this.register(new SemanticConsolidationPass());
    this.register(new SemanticRelationshipResolutionPass());
    this.register(new SemanticIdentityAssignmentPass());
    this.register(new GraphConstructionPass());
  }

  private validateStructure(): void {
    const metadata = this.list();
    const ids = new Set(metadata.map((entry) => entry.id));

    for (const entry of metadata) {
      for (const dependency of entry.dependencies) {
        if (!ids.has(dependency)) {
          throw new Error(`Pass ${entry.id} has missing dependency: ${dependency}`);
        }
      }
    }

    const ordered = this.executablePassOrder().map((entry) => entry.metadata.id);
    const expected = [
      "bgc.input-validation",
      "bgc.canonical-verification",
      "bgc.evidence-grouping",
      "bgc.evidence-correlation",
      "bgc.semantic-resolution",
      "bgc.semantic-consolidation",
      "bgc.relationship-resolution",
      "bgc.identity-assignment",
      "bgc.graph-construction",
    ];

    if (stableList(ordered) !== stableList(expected)) {
      throw new Error(`Business Genome pass order is invalid. Expected ${expected.join(" -> ")}, got ${ordered.join(" -> ")}`);
    }
  }
}

function stableList(values: readonly string[]): string {
  return values.join("|");
}
