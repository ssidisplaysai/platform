import type { CompilerDiagnostic } from "../core/types";
import { CompilerDiagnosticsEngine } from "../core/CompilerDiagnosticsEngine";
import { CompilerValidationEngine } from "../core/CompilerValidationEngine";
import { BGC_DIAGNOSTIC_CODES, sortDiagnostics } from "./diagnostics";
import { BusinessGenomePassRegistry } from "./BusinessGenomePassRegistry";
import { BGC_ARCHITECTURAL_PASS_ORDER } from "./pipeline-types";
import type {
  BusinessGenomePassResult,
  CanonicalEvidenceAttestation,
  CorrelatedEvidenceCollection,
  GroupedEvidenceCollection,
  SemanticCandidateCollection,
  ConsolidatedSemanticCollection,
  ResolvedRelationshipCollection,
  BusinessGenomeIdentityCollection,
  BusinessGenomeGraph,
  BusinessGenomeValidationResult,
  ValidatedEvidenceIRView,
} from "./pipeline-types";
import type {
  BusinessGenomeCompilerInput,
  BusinessGenomeCompilerOutput,
  BusinessGenomeIntermediateCompilation,
} from "./types";

export class BusinessGenomeCompiler {
  private readonly registry = new BusinessGenomePassRegistry();
  private readonly diagnostics = new CompilerDiagnosticsEngine();
  private readonly validator = new CompilerValidationEngine();

  compile(input: BusinessGenomeCompilerInput): BusinessGenomeCompilerOutput {
    const startedAt = new Date().toISOString();
    const completedPasses: string[] = [];
    let haltedByPassId: string | undefined;
    const passOutputs = new Map<string, unknown>();

    const passContractDiagnostics = this.validator.validatePassContracts(this.registry.list());
    for (const diagnostic of passContractDiagnostics) {
      this.diagnostics.report(
        diagnostic.severity,
        diagnostic.code,
        diagnostic.message,
        diagnostic.details,
        diagnostic.passId,
        diagnostic.artifactId,
      );
    }

    if (this.diagnostics.hasErrors()) {
      return this.buildOutput(
        input,
        {
          validatedEvidence: null,
          canonicalAttestation: null,
          groupedEvidence: null,
          correlatedEvidence: null,
          semanticCandidates: null,
          consolidatedSemantics: null,
          resolvedRelationships: null,
          identityAssignment: null,
          graph: null,
          validation: null,
        },
        startedAt,
        completedPasses,
        BGC_DIAGNOSTIC_CODES.PIPELINE.PASS_CONTRACT_VALIDATION_FAILED,
      );
    }

    for (const pass of this.registry.executablePassOrder()) {
      let passInput: unknown;
      if (pass.metadata.dependencies.length === 0) {
        passInput = input;
      } else if (pass.metadata.dependencies.length === 1) {
        passInput = passOutputs.get(pass.metadata.dependencies[0]);
      } else {
        passInput = Object.fromEntries(
          pass.metadata.dependencies.map((dependencyId) => [dependencyId, passOutputs.get(dependencyId)]),
        );
      }

      try {
        const result = pass.execute(passInput as never, input.compilerContext) as BusinessGenomePassResult<unknown>;

        for (const diagnostic of result.diagnostics) {
          this.diagnostics.report(
            diagnostic.severity,
            diagnostic.code,
            diagnostic.message,
            diagnostic.details,
            diagnostic.passId,
            diagnostic.artifactId,
          );
        }

        passOutputs.set(pass.metadata.id, result.output);

        if (result.fatal) {
          haltedByPassId = pass.metadata.id;
          break;
        }

        completedPasses.push(pass.metadata.id);
      } catch (error) {
        haltedByPassId = pass.metadata.id;
        this.diagnostics.report(
          "error",
          BGC_DIAGNOSTIC_CODES.PIPELINE.PASS_EXECUTION_FAILED,
          `Pass ${pass.metadata.id} failed: ${error instanceof Error ? error.message : String(error)}`,
          {
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          pass.metadata.id,
        );
        break;
      }
    }

    const intermediate: BusinessGenomeIntermediateCompilation = {
      validatedEvidence: (passOutputs.get("bgc.input-validation") as ValidatedEvidenceIRView | undefined) ?? null,
      canonicalAttestation:
        (passOutputs.get("bgc.canonical-verification") as CanonicalEvidenceAttestation | undefined) ?? null,
      groupedEvidence: (passOutputs.get("bgc.evidence-grouping") as GroupedEvidenceCollection | undefined) ?? null,
      correlatedEvidence:
        (passOutputs.get("bgc.evidence-correlation") as CorrelatedEvidenceCollection | undefined) ?? null,
      semanticCandidates:
        (passOutputs.get("bgc.semantic-resolution") as SemanticCandidateCollection | undefined) ?? null,
      consolidatedSemantics:
        (passOutputs.get("bgc.semantic-consolidation") as ConsolidatedSemanticCollection | undefined) ?? null,
      resolvedRelationships:
        (passOutputs.get("bgc.relationship-resolution") as ResolvedRelationshipCollection | undefined) ?? null,
      identityAssignment:
        (passOutputs.get("bgc.identity-assignment") as BusinessGenomeIdentityCollection | undefined) ?? null,
      graph: (passOutputs.get("bgc.graph-construction") as BusinessGenomeGraph | undefined) ?? null,
      validation:
        (passOutputs.get("bgc.consistency-validation") as BusinessGenomeValidationResult | undefined) ?? null,
    };

    const expectedOutputs = [
      "bgc.input-validation",
      "bgc.canonical-verification",
      "bgc.evidence-grouping",
      "bgc.evidence-correlation",
      "bgc.semantic-resolution",
      "bgc.semantic-consolidation",
      "bgc.relationship-resolution",
      "bgc.identity-assignment",
      "bgc.graph-construction",
      "bgc.consistency-validation",
    ] as const;

    for (const passId of expectedOutputs) {
      if (!passOutputs.has(passId) && !haltedByPassId) {
        this.diagnostics.report(
          "error",
          BGC_DIAGNOSTIC_CODES.PIPELINE.MISSING_REQUIRED_PASS_OUTPUT,
          `Required pass output missing: ${passId}`,
          {
            passId,
          },
          passId,
        );
      }
    }

    return this.buildOutput(input, intermediate, startedAt, completedPasses, haltedByPassId);
  }

  getRegistry(): BusinessGenomePassRegistry {
    return this.registry;
  }

  private buildOutput(
    input: BusinessGenomeCompilerInput,
    intermediate: BusinessGenomeIntermediateCompilation,
    startedAt: string,
    completedPasses: readonly string[],
    haltedByPassId?: string,
  ): BusinessGenomeCompilerOutput {
    const diagnostics = sortDiagnostics(this.diagnostics.list());
    const hasErrors = diagnostics.some((entry) => entry.severity === "error");
    const completedPassSet = new Set(completedPasses);
    const pendingPasses = BGC_ARCHITECTURAL_PASS_ORDER.filter((passId) => !completedPassSet.has(passId));

    return {
      status: hasErrors ? "failed" : "intermediate",
      intermediate,
      diagnostics,
      success: !hasErrors,
      execution: {
        sessionId: input.compilerContext.sessionId,
        startedAt,
        completedAt: new Date().toISOString(),
        passOrder: [...BGC_ARCHITECTURAL_PASS_ORDER],
        completedPasses: [...completedPasses],
        pendingPasses,
        haltedByPassId,
      },
    };
  }
}
