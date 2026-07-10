import { SourceHash } from "../provenance/SourceHash";
import type { EvidenceIR } from "./EvidenceIR";
import type { EvidenceGraph } from "./EvidenceGraph";

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

export class EvidenceGraphHasher {
  hashGraph(graph: EvidenceGraph): string {
    return SourceHash.sha256(stableStringify(graph.toObject()));
  }

  hashIR(ir: Omit<EvidenceIR, "deterministicHash">): string {
    return SourceHash.sha256(
      stableStringify({
        schemaVersion: ir.schemaVersion,
        graph: ir.graph.toObject(),
        artifactCount: ir.artifactCount,
        generatedAt: ir.generatedAt,
      }),
    );
  }
}
