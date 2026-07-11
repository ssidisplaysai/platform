import type { EvidenceIR } from "../../evidence/EvidenceIR";
import { EvidenceEmitter } from "../../evidence/EvidenceEmitter";
import type { CompilerPass } from "../types";
import type { DiscoveryPassOutput } from "./DiscoveryCompilerPass";

export interface EvidencePassOutput {
  evidenceIR: EvidenceIR;
}

export class EvidenceCompilerPass implements CompilerPass<DiscoveryPassOutput, EvidencePassOutput> {
  readonly metadata = {
    id: "evidence-pass",
    version: "1.0.0",
    description: "Evidence compiler pass wrapper for Compiler Core orchestration",
    inputType: "knowledge-artifacts",
    outputType: "evidence-ir",
    dependencies: ["discovery-pass"],
    capabilities: ["evidence", "emission"],
    lifecycle: "active" as const,
  };

  constructor(private readonly emitter: EvidenceEmitter = new EvidenceEmitter()) {}

  execute(input: DiscoveryPassOutput): EvidencePassOutput {
    return {
      evidenceIR: this.emitter.emit(input.artifacts),
    };
  }
}
