import type {
  RuntimePolicyCompilationPassResult,
  RuntimePolicyCompilerConfig,
  RuntimePolicyCompilerPassName,
  RuntimePolicyCompilerState,
  RuntimePolicyDiagnostic,
  RuntimePolicyEvidenceEntry,
} from "./types";
import { createDigest, deepFreeze } from "./types";

export interface RuntimePolicyCompilerPass {
  readonly name: RuntimePolicyCompilerPassName;

  execute(state: RuntimePolicyCompilerState, context: RuntimePolicyCompilerPassContext): RuntimePolicyCompilerState;
}

export interface RuntimePolicyCompilerPassContext {
  readonly config: RuntimePolicyCompilerConfig;
}

export function appendDiagnostic(
  diagnostics: readonly RuntimePolicyDiagnostic[],
  level: RuntimePolicyDiagnostic["level"],
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): readonly RuntimePolicyDiagnostic[] {
  const sequence = diagnostics.length + 1;
  const next = deepFreeze({ sequence, level, code, message, details });
  return Object.freeze([...diagnostics, next]);
}

export function appendEvidence(
  evidence: readonly RuntimePolicyEvidenceEntry[],
  type: string,
  details: Readonly<Record<string, unknown>>,
): readonly RuntimePolicyEvidenceEntry[] {
  const sequence = evidence.length + 1;
  const next = deepFreeze({ sequence, type, details });
  return Object.freeze([...evidence, next]);
}

export function withPassResult(
  state: RuntimePolicyCompilerState,
  passName: RuntimePolicyCompilerPassName,
  previousStateDigest: string,
  options: {
    success?: boolean;
    failureReason?: string;
  } = {},
): RuntimePolicyCompilerState {
  const sequence = state.passResults.length + 1;
  const diagnosticsDigest = createDigest(state.diagnostics);
  const evidenceDigest = createDigest(state.evidence);
  const outputDigest = createDigest({
    normalizedDefinition: state.normalizedDefinition,
    conflictMetadata: state.conflictMetadata,
    generatedIds: state.generatedIds,
    runtimePolicyIr: state.runtimePolicyIr,
    certificate: state.certificate,
  });

  const result: RuntimePolicyCompilationPassResult = deepFreeze({
    passName,
    sequence,
    success: options.success ?? true,
    failureReason: options.failureReason,
    inputDigest: previousStateDigest,
    outputDigest,
    diagnosticsDigest,
    evidenceDigest,
  });

  return deepFreeze({ ...state, passResults: Object.freeze([...state.passResults, result]) });
}
