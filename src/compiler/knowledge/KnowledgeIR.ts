import type { KnowledgeGraph } from "./KnowledgeGraph";

export interface KnowledgeIR {
  schemaVersion: "1.0.0";
  graph: KnowledgeGraph;
  claimCount: number;
  compiledFromEvidenceHash: string;
  generatedAt: string;
  deterministicHash: string;
}
