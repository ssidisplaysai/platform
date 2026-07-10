import type { EvidenceGraph } from "./EvidenceGraph";

export interface EvidenceIR {
  schemaVersion: "1.0.0";
  graph: EvidenceGraph;
  artifactCount: number;
  generatedAt: string;
  deterministicHash: string;
}
