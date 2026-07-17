import { RuntimePolicyCompiler } from "./RuntimePolicyCompiler";
import { RuntimePolicyDiagnostics } from "./RuntimePolicyDiagnostics";
import { RuntimePolicyEvaluator } from "./RuntimePolicyEvaluator";
import { RuntimePolicyEvidence } from "./RuntimePolicyEvidence";
import { RuntimePolicyFactCompiler } from "./RuntimePolicyFactCompiler";
import { RuntimePolicyFactCompilationError } from "./RuntimePolicyFactCompiler";
import { RuntimePolicyReplay } from "./RuntimePolicyReplay";
import { RuntimePolicyResolver } from "./RuntimePolicyResolver";
import { RuntimePolicySnapshotStore } from "./RuntimePolicySnapshotStore";
import { RuntimePolicyTelemetry } from "./RuntimePolicyTelemetry";
import type {
  RuntimePolicyCompilationResult,
  RuntimePolicyCompilerConfig,
  RuntimePolicyDecision,
  RuntimePolicyDefinition,
  RuntimePolicyDiagnostic,
  RuntimePolicyEvidenceEntry,
  RuntimePolicyEvaluationContext,
  RuntimePolicyFact,
  RuntimePolicyFactIR,
  RuntimePolicyIR,
} from "./types";
import { deepFreeze } from "./types";

export class RuntimePolicyManager {
  private readonly executionContextId: string;
  private readonly compiler: RuntimePolicyCompiler;
  private readonly resolver = new RuntimePolicyResolver();
  private readonly evaluator = new RuntimePolicyEvaluator();
  private readonly factCompiler = new RuntimePolicyFactCompiler();
  private readonly replay = new RuntimePolicyReplay(this.evaluator);
  private readonly diagnostics = new RuntimePolicyDiagnostics();
  private readonly evidence = new RuntimePolicyEvidence();
  private readonly telemetry = new RuntimePolicyTelemetry();
  private readonly snapshots: RuntimePolicySnapshotStore;
  private readonly policiesByContext = new Map<string, Map<string, RuntimePolicyCompilationResult>>();
  private readonly policyObjectOwnership = new WeakSet<RuntimePolicyIR>();

  constructor(config: RuntimePolicyCompilerConfig) {
    this.executionContextId = config.runtimeExecutionContextId;
    this.compiler = new RuntimePolicyCompiler(config);
    this.snapshots = new RuntimePolicySnapshotStore(this.executionContextId);
    this.policiesByContext.set(this.executionContextId, new Map<string, RuntimePolicyCompilationResult>());
  }

  compileAndRegister(definition: RuntimePolicyDefinition): RuntimePolicyCompilationResult {
    const result = this.compiler.compile(definition);

    if (!result.success || !result.runtimePolicyIr || !result.certificate) {
      this.telemetry.increment("policy.compile.failed");
      this.diagnostics.log("Error", "GRT-POL-COMP-002", "Policy compile rejected.", {
        executionContextId: this.executionContextId,
        failureReason: result.failureReason,
        failedPassName: result.failedPassName,
      });
      this.evidence.append("PolicyCompileRejected", {
        executionContextId: this.executionContextId,
        failureReason: result.failureReason ?? "Invalid policy definition.",
      });
      return result;
    }

    const local = this.contextPolicies();
    if (local.has(result.runtimePolicyIr.runtimePolicyIrId)) {
      this.telemetry.increment("policy.register.duplicate");
      this.diagnostics.log("Error", "GRT-POL-REG-001", "Duplicate runtime policy registration rejected.", {
        executionContextId: this.executionContextId,
        runtimePolicyIrId: result.runtimePolicyIr.runtimePolicyIrId,
      });
      this.evidence.append("PolicyRegistrationRejected", {
        executionContextId: this.executionContextId,
        runtimePolicyIrId: result.runtimePolicyIr.runtimePolicyIrId,
      });
      throw new Error(`GRT-POL-REG-001: Duplicate runtime policy registration ${result.runtimePolicyIr.runtimePolicyIrId}`);
    }

    local.set(result.runtimePolicyIr.runtimePolicyIrId, result);
    this.policyObjectOwnership.add(result.runtimePolicyIr);

    this.telemetry.increment("policy.compile.success");
    this.telemetry.increment("policy.compiled");
    this.telemetry.increment("policy.registered");
    this.evidence.append("PolicyCompiled", {
      executionContextId: this.executionContextId,
      runtimePolicyIrId: result.runtimePolicyIr.runtimePolicyIrId,
      certificateId: result.certificate.certificateId,
    });

    this.snapshots.save(this.executionContextId, result.runtimePolicyIr.runtimePolicyIrId, deepFreeze({
      runtimePolicyIr: result.runtimePolicyIr,
      certificate: result.certificate,
      diagnostics: result.diagnostics,
      evidence: result.evidence,
      telemetry: this.telemetry.snapshot(),
    }));

    return result;
  }

  evaluate(policyRuntimeId: string, facts: readonly RuntimePolicyFact[], context: RuntimePolicyEvaluationContext): RuntimePolicyDecision {
    this.assertContextOwnership(context.executionContextId);
    const candidates = this.listPolicies();
    this.assertCandidatePartition(candidates);
    const resolution = this.resolver.resolve({
      policyRuntimeId,
      policyIrCandidates: candidates,
      context,
    });
    this.evidence.append("PolicyResolved", {
      executionContextId: this.executionContextId,
      runtimePolicyIrId: resolution.runtimePolicyIr.runtimePolicyIrId,
      selectedBy: resolution.selectedBy,
      candidateCount: resolution.candidateCount,
    });

    const factIr = this.compileFactIr(facts, context.schemaVersion);
    const decision = this.evaluator.evaluate({
      runtimePolicyIr: resolution.runtimePolicyIr,
      facts: factIr,
      context,
    });

    this.telemetry.increment("policy.evaluate");
    this.telemetry.increment("policy.evaluated");
    if (decision.decision === "Permit") {
      this.telemetry.increment("policy.permit");
    } else if (decision.decision === "Deny") {
      this.telemetry.increment("policy.denied");
    } else if (decision.decision === "Conditional") {
      this.telemetry.increment("policy.conditional");
    } else if (decision.decision === "NotApplicable") {
      this.telemetry.increment("policy.notapplicable");
    } else {
      this.telemetry.increment("policy.indeterminate");
    }
    this.evidence.append("PolicyEvaluated", {
      executionContextId: this.executionContextId,
      runtimePolicyIrId: resolution.runtimePolicyIr.runtimePolicyIrId,
      decisionId: decision.decisionId,
      decision: decision.decision,
    });

    return decision;
  }

  replayDecision(runtimePolicyIr: RuntimePolicyIR, facts: readonly RuntimePolicyFactIR[], context: RuntimePolicyEvaluationContext): RuntimePolicyDecision {
    this.assertContextOwnership(context.executionContextId);
    this.assertPolicyRegistered(runtimePolicyIr);
    this.telemetry.increment("policy.replay");
    this.telemetry.increment("policy.replayed");
    const decision = this.replay.replay(runtimePolicyIr, facts, context);
    this.evidence.append("PolicyReplayed", {
      executionContextId: this.executionContextId,
      runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      decisionId: decision.decisionId,
    });
    return decision;
  }

  listPolicies(): readonly RuntimePolicyIR[] {
    return Object.freeze(
      [...this.contextPolicies().values()]
        .map((entry) => entry.runtimePolicyIr)
        .sort((a, b) => a.runtimePolicyIrId.localeCompare(b.runtimePolicyIrId)),
    );
  }

  diagnosticsLog(): readonly RuntimePolicyDiagnostic[] {
    return this.diagnostics.all();
  }

  evidenceLog(): readonly RuntimePolicyEvidenceEntry[] {
    return this.evidence.all();
  }

  telemetrySnapshot() {
    return this.telemetry.snapshot();
  }

  private contextPolicies(): Map<string, RuntimePolicyCompilationResult> {
    const policies = this.policiesByContext.get(this.executionContextId);
    if (!policies) {
      throw new Error(`GRT-POL-CTX-001: Missing policy context registry for execution context ${this.executionContextId}`);
    }
    return policies;
  }

  private compileFactIr(facts: readonly RuntimePolicyFact[], schemaVersion: string): readonly RuntimePolicyFactIR[] {
    try {
      return this.factCompiler.compileMany(facts, schemaVersion);
    } catch (error) {
      if (error instanceof RuntimePolicyFactCompilationError) {
        this.diagnostics.log("Error", error.code, error.failureReason, {
          factKey: error.factKey,
          factType: error.factType,
        });
        this.evidence.append(error.evidence.type, error.evidence.details);
        throw new Error(`${error.code}: ${error.failureReason}`);
      }
      throw error;
    }
  }

  private assertCandidatePartition(candidates: readonly RuntimePolicyIR[]): void {
    const local = this.contextPolicies();
    for (const candidate of candidates) {
      const registered = local.get(candidate.runtimePolicyIrId);
      if (!registered || !registered.runtimePolicyIr || registered.runtimePolicyIr.runtimePolicyIrDigest !== candidate.runtimePolicyIrDigest) {
        this.telemetry.increment("policy.candidate.rejected");
        this.diagnostics.log("Error", "GRT-POL-RES-CTX-001", "Resolver candidate is not context-local.", {
          runtimePolicyIrId: candidate.runtimePolicyIrId,
        });
        this.evidence.append("ResolverCandidateRejected", {
          executionContextId: this.executionContextId,
          runtimePolicyIrId: candidate.runtimePolicyIrId,
        });
        throw new Error(
          `GRT-POL-RES-CTX-001: Resolver candidate ${candidate.runtimePolicyIrId} is not registered in execution context ${this.executionContextId}`,
        );
      }
    }
  }

  private assertPolicyRegistered(runtimePolicyIr: RuntimePolicyIR): void {
    const registered = this.contextPolicies().get(runtimePolicyIr.runtimePolicyIrId);
    if (!registered || !registered.runtimePolicyIr) {
      this.telemetry.increment("policy.replay.rejected");
      this.telemetry.increment("policy.replay.failed");
      this.diagnostics.log("Error", "GRT-POL-REPLAY-CTX-001", "Replay rejected for unregistered policy artifact.", {
        runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      });
      this.evidence.append("ReplayPolicyRejected", {
        executionContextId: this.executionContextId,
        runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      });
      throw new Error(`GRT-POL-REPLAY-CTX-001: RuntimePolicyIR ${runtimePolicyIr.runtimePolicyIrId} is not registered in context.`);
    }
    if (registered.runtimePolicyIr.runtimePolicyIrDigest !== runtimePolicyIr.runtimePolicyIrDigest) {
      this.telemetry.increment("policy.replay.rejected");
      this.telemetry.increment("policy.replay.failed");
      this.diagnostics.log("Error", "GRT-POL-REPLAY-CTX-002", "Replay rejected due to policy digest mismatch.", {
        runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      });
      this.evidence.append("ReplayPolicyRejected", {
        executionContextId: this.executionContextId,
        runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      });
      throw new Error(
        `GRT-POL-REPLAY-CTX-002: RuntimePolicyIR digest mismatch for ${runtimePolicyIr.runtimePolicyIrId} in execution context ${this.executionContextId}`,
      );
    }
    if (!this.policyObjectOwnership.has(runtimePolicyIr)) {
      this.telemetry.increment("policy.replay.rejected");
      this.telemetry.increment("policy.replay.failed");
      this.diagnostics.log("Error", "GRT-POL-REPLAY-CTX-003", "Replay rejected for non-owned RuntimePolicyIR object instance.", {
        runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      });
      this.evidence.append("ReplayPolicyRejected", {
        executionContextId: this.executionContextId,
        runtimePolicyIrId: runtimePolicyIr.runtimePolicyIrId,
      });
      throw new Error(
        `GRT-POL-REPLAY-CTX-003: RuntimePolicyIR ${runtimePolicyIr.runtimePolicyIrId} is not owned by execution context ${this.executionContextId}`,
      );
    }
  }

  private assertContextOwnership(executionContextId: string): void {
    if (executionContextId !== this.executionContextId) {
      this.telemetry.increment("policy.context.rejected");
      this.evidence.append("PolicyContextRejected", {
        expectedExecutionContextId: this.executionContextId,
        receivedExecutionContextId: executionContextId,
      });
      throw new Error(
        `GRT-POL-CTX-002: Cross-context policy access denied. Expected ${this.executionContextId}, received ${executionContextId}`,
      );
    }
  }
}
