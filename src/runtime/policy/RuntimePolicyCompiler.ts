import { RuntimePolicyDefinition } from "./RuntimePolicyDefinition";
import type {
  RuntimePolicyCompilationPassResult,
  RuntimePolicyCompilerPassName,
  RuntimePolicyCompilationResult,
  RuntimePolicyCompilerConfig,
  RuntimePolicyCompilerState,
  RuntimePolicyDefinition as RuntimePolicyDefinitionRecord,
} from "./types";
import { appendDiagnostic, appendEvidence } from "./RuntimePolicyCompilerPass";
import { createDigest, deepFreeze } from "./types";
import type { RuntimePolicyCompilerPass, RuntimePolicyCompilerPassContext } from "./RuntimePolicyCompilerPass";
import { CanonicalOrderingPass } from "./passes/CanonicalOrderingPass";
import { CompilationCertificationPass } from "./passes/CompilationCertificationPass";
import { ConflictAnalysisPass } from "./passes/ConflictAnalysisPass";
import { DefinitionValidationPass } from "./passes/DefinitionValidationPass";
import { DependencyResolutionPass } from "./passes/DependencyResolutionPass";
import { DeterministicOptimizationPass } from "./passes/DeterministicOptimizationPass";
import { IdentityAssignmentPass } from "./passes/IdentityAssignmentPass";
import { NormalizationPass } from "./passes/NormalizationPass";
import { PolicyIRGenerationPass } from "./passes/PolicyIRGenerationPass";

export class RuntimePolicyCompiler {
  private readonly passes: readonly RuntimePolicyCompilerPass[];

  constructor(private readonly config: RuntimePolicyCompilerConfig) {
    this.passes = Object.freeze([
      new DefinitionValidationPass(),
      new CanonicalOrderingPass(),
      new NormalizationPass(),
      new DependencyResolutionPass(),
      new ConflictAnalysisPass(),
      new DeterministicOptimizationPass(),
      new IdentityAssignmentPass(),
      new PolicyIRGenerationPass(),
      new CompilationCertificationPass(),
    ]);
  }

  compile(definition: RuntimePolicyDefinitionRecord): RuntimePolicyCompilationResult {
    let state: RuntimePolicyCompilerState | undefined;
    let currentPassName: RuntimePolicyCompilerPassName | undefined;

    try {
      const immutableDefinition = RuntimePolicyDefinition.immutable(definition).snapshot();
      const definitionDigest = createDigest(immutableDefinition);

      state = deepFreeze({
        definition: immutableDefinition,
        definitionDigest,
        normalizedDefinition: immutableDefinition,
        passResults: Object.freeze([]),
        diagnostics: Object.freeze([]),
        evidence: Object.freeze([]),
        conflictMetadata: deepFreeze({}),
        generatedIds: deepFreeze({}),
        failed: false,
      });

      const context: RuntimePolicyCompilerPassContext = { config: this.config };
      for (const pass of this.passes) {
        if (state.failed) {
          break;
        }
        currentPassName = pass.name;
        state = pass.execute(state, context);
      }
      if (state.failed) {
        return this.invalidResult(state, state.failureReason ?? "GRT-POL-COMP-INVALID: Compilation failed.");
      }

      if (!state.runtimePolicyIr || !state.certificate) {
        return this.invalidResult(
          state,
          "GRT-POL-COMP-001: Compiler completed without RuntimePolicyIR and certificate.",
          "CompilationCertification",
        );
      }

      return deepFreeze({
        success: true,
        validationResult: "Valid",
        compilerId: this.config.compilerId,
        compilerVersion: this.config.compilerVersion,
        runtimePolicyIr: state.runtimePolicyIr,
        certificate: state.certificate,
        diagnostics: state.diagnostics,
        evidence: state.evidence,
        passResults: state.passResults,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown compiler exception.";
      const normalized = message.startsWith("GRT-POL-")
        ? message
        : `GRT-POL-COMP-EX-001: ${message}`;
      if (!state) {
        try {
          const fallbackDefinition = RuntimePolicyDefinition.immutable(definition).snapshot();
          state = deepFreeze({
            definition: fallbackDefinition,
            definitionDigest: createDigest(fallbackDefinition),
            normalizedDefinition: fallbackDefinition,
            passResults: Object.freeze([]),
            diagnostics: Object.freeze([]),
            evidence: Object.freeze([]),
            conflictMetadata: deepFreeze({}),
            generatedIds: deepFreeze({}),
            failed: false,
          });
        } catch {
          const fallbackDefinition = deepFreeze({
            policyDefinitionId: "invalid-policy-definition",
            name: "invalid",
            version: "invalid",
            lifecycleState: "Draft" as const,
            schemaVersion: this.config.schemaVersion,
            conflictStrategy: "deny-overrides" as const,
            policySetIds: Object.freeze([]),
            dependencyPolicyIds: Object.freeze([]),
            rules: Object.freeze([]),
            metadata: deepFreeze({}),
          });
          state = deepFreeze({
            definition: fallbackDefinition,
            definitionDigest: createDigest(fallbackDefinition),
            normalizedDefinition: fallbackDefinition,
            passResults: Object.freeze([]),
            diagnostics: Object.freeze([]),
            evidence: Object.freeze([]),
            conflictMetadata: deepFreeze({}),
            generatedIds: deepFreeze({}),
            failed: false,
          });
        }
      }
      return this.invalidResult(state, normalized, currentPassName);
    }
  }

  private invalidResult(
    state: RuntimePolicyCompilerState,
    failureReason: string,
    failedPassName?: RuntimePolicyCompilerPassName,
  ): RuntimePolicyCompilationResult {
    const resolvedFailedPassName = failedPassName ?? state.passResults[state.passResults.length - 1]?.passName;
    const diagnostics = appendDiagnostic(
      state.diagnostics,
      "Error",
      "GRT-POL-COMP-003",
      "Runtime policy compilation failed.",
      deepFreeze({
        failureReason,
        failedPassName: resolvedFailedPassName,
      }),
    );
    const evidence = appendEvidence(state.evidence, "CompilationFailed", {
      failureReason,
      failedPassName: resolvedFailedPassName,
      compilerId: this.config.compilerId,
      compilerVersion: this.config.compilerVersion,
    });
    let passResults: readonly RuntimePolicyCompilationPassResult[] = state.passResults;
    if (resolvedFailedPassName && (passResults.length === 0 || passResults[passResults.length - 1]?.passName !== resolvedFailedPassName)) {
      const inputDigest = createDigest(state.normalizedDefinition);
      const outputDigest = createDigest({
        normalizedDefinition: state.normalizedDefinition,
        conflictMetadata: state.conflictMetadata,
        generatedIds: state.generatedIds,
      });
      const failedResult: RuntimePolicyCompilationPassResult = deepFreeze({
        passName: resolvedFailedPassName,
        sequence: passResults.length + 1,
        success: false,
        failureReason,
        inputDigest,
        outputDigest,
        diagnosticsDigest: createDigest(diagnostics),
        evidenceDigest: createDigest(evidence),
      });
      passResults = Object.freeze([...passResults, failedResult]);
    }
    const failureDigest = createDigest({
      failureReason,
      failedPassName: resolvedFailedPassName,
      diagnostics,
      evidence,
      passResults,
      compilerId: this.config.compilerId,
      compilerVersion: this.config.compilerVersion,
    });

    return deepFreeze({
      success: false,
      validationResult: "Invalid",
      failureReason,
      failureDigest,
      failedPassName: resolvedFailedPassName,
      compilerId: this.config.compilerId,
      compilerVersion: this.config.compilerVersion,
      diagnostics,
      evidence,
      passResults,
    });
  }
}
