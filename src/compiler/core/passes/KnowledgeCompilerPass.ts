import type { EvidencePassOutput } from "./EvidenceCompilerPass";
import { KnowledgeCompiler } from "../../knowledge/KnowledgeCompiler";
import type { KnowledgeIR } from "../../knowledge/KnowledgeIR";
import type { CompilerPass } from "../types";

export interface KnowledgePassOutput {
  knowledgeIR: KnowledgeIR;
}

export class KnowledgeCompilerPass implements CompilerPass<EvidencePassOutput, KnowledgePassOutput> {
  readonly metadata = {
    id: "knowledge-pass",
    version: "1.0.0",
    description: "Knowledge compiler pass wrapper for Compiler Core orchestration",
    inputType: "evidence-ir",
    outputType: "knowledge-ir",
    dependencies: ["evidence-pass"],
    capabilities: ["knowledge", "canonicalization", "conflict-preservation"],
    lifecycle: "active" as const,
  };

  constructor(private readonly compiler: KnowledgeCompiler = new KnowledgeCompiler()) {}

  execute(input: EvidencePassOutput): KnowledgePassOutput {
    return {
      knowledgeIR: this.compiler.compile(input.evidenceIR),
    };
  }
}