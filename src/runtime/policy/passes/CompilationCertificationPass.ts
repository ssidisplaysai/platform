import type { RuntimePolicyCompilerPass } from "../RuntimePolicyCompilerPass";
import { appendEvidence } from "../RuntimePolicyCompilerPass";
import { createDigest, deepFreeze, stablePrimitiveRecord } from "../types";

export class CompilationCertificationPass implements RuntimePolicyCompilerPass {
  readonly name = "CompilationCertification" as const;

  execute(state: Parameters<RuntimePolicyCompilerPass["execute"]>[0], context: Parameters<RuntimePolicyCompilerPass["execute"]>[1]): Parameters<RuntimePolicyCompilerPass["execute"]>[0] {
    if (!state.runtimePolicyIr) {
      throw new Error("GRT-POL-CERT-001: RuntimePolicyIR must exist before certification.");
    }

    const inputDigest = createDigest(state.runtimePolicyIr);
    const certificationEvidence = appendEvidence(state.evidence, "CompilationCertificateIssued", {
      runtimePolicyIrId: state.runtimePolicyIr.runtimePolicyIrId,
      policyDefinitionId: state.runtimePolicyIr.policyDefinitionId,
    });

    const diagnosticsDigest = createDigest(state.diagnostics);
    const evidenceDigest = createDigest(certificationEvidence);
    const validationDigest = createDigest({
      definitionDigest: state.definitionDigest,
      runtimePolicyIrDigest: state.runtimePolicyIr.runtimePolicyIrDigest,
      diagnosticsDigest,
      evidenceDigest,
    });

    const passOutputDigest = createDigest({
      normalizedDefinition: state.normalizedDefinition,
      conflictMetadata: state.conflictMetadata,
      generatedIds: state.generatedIds,
      runtimePolicyIr: state.runtimePolicyIr,
      validationDigest,
      diagnosticsDigest,
      evidenceDigest,
    });

    const certificationPassResult = deepFreeze({
      passName: this.name,
      sequence: state.passResults.length + 1,
      success: true,
      inputDigest,
      outputDigest: passOutputDigest,
      diagnosticsDigest,
      evidenceDigest,
    });

    const finalPassResults = Object.freeze([...state.passResults, certificationPassResult]);

    const certificateId = `policy-certificate-${createDigest({
      policyDefinitionId: state.runtimePolicyIr.policyDefinitionId,
      runtimePolicyIrId: state.runtimePolicyIr.runtimePolicyIrId,
      passResults: finalPassResults,
      validationDigest,
      diagnosticsDigest,
      evidenceDigest,
    }).slice(0, 16)}`;

    const certificate = deepFreeze({
      certificateId,
      policyDefinitionId: state.runtimePolicyIr.policyDefinitionId,
      policyDefinitionDigest: state.definitionDigest,
      runtimePolicyIrId: state.runtimePolicyIr.runtimePolicyIrId,
      runtimePolicyIrDigest: state.runtimePolicyIr.runtimePolicyIrDigest,
      compilerId: context.config.compilerId,
      compilerVersion: context.config.compilerVersion,
      compilationSequence: state.passResults.length + 1,
      validationResult: "Valid" as const,
      validationDigest,
      diagnosticsDigest,
      evidenceDigest,
      passResults: finalPassResults,
      schemaVersion: context.config.schemaVersion,
      metadata: stablePrimitiveRecord({
        policyName: state.normalizedDefinition.name,
        policyVersion: state.normalizedDefinition.version,
      }),
    });

    return deepFreeze({
      ...state,
      certificate,
      evidence: certificationEvidence,
      passResults: finalPassResults,
    });
  }
}
