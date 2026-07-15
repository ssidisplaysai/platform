import { SourceHash } from "../provenance/SourceHash";
import { stableStringify } from "./stableStringify";
import type { CompilerExecutionPlanStep, CompilerPassKind } from "./types";

export class CompilerExecutionPlan {
  readonly id: string;
  readonly pipelineVersion: string;
  readonly steps: readonly CompilerExecutionPlanStep[];

  constructor(steps: readonly CompilerExecutionPlanStep[], pipelineVersion: string) {
    this.pipelineVersion = pipelineVersion;
    this.steps = [...steps].sort((left, right) => left.order - right.order);
    this.id = SourceHash.sha256(stableStringify({ pipelineVersion, steps: this.steps })).slice(0, 24);
  }

  static createStep(
    passId: string,
    order: number,
    dependencies: readonly string[],
    kind: CompilerPassKind = "execution",
  ): CompilerExecutionPlanStep {
    return Object.freeze({
      passId,
      order,
      dependencies: [...dependencies],
      kind,
    });
  }
}