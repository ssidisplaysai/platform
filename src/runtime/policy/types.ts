import { createHash } from "node:crypto";

export type RuntimePolicyPrimitive = string | number | boolean | null;

export type RuntimePolicyDecisionType = "Permit" | "Deny" | "Conditional" | "NotApplicable" | "Indeterminate";

export type RuntimePolicyConflictStrategy = "deny-overrides" | "permit-overrides" | "first-applicable" | "only-one-applicable";

export type RuntimePolicyEffect = "Permit" | "Deny" | "Conditional";

export type RuntimePolicyLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export type RuntimePolicyConditionOperator =
  | "Equals"
  | "NotEquals"
  | "GreaterThan"
  | "GreaterThanOrEquals"
  | "LessThan"
  | "LessThanOrEquals"
  | "Contains"
  | "Exists";

export type RuntimePolicyDefinitionLifecycle = "Draft" | "Active" | "Deprecated" | "Archived";

export type RuntimePolicyFactType = "String" | "Number" | "Boolean" | "Json" | "Null";

export type RuntimePolicyFactSourceKind = "SecurityContext" | "Runtime" | "Message" | "Workflow" | "Host" | "External";

export type RuntimePolicyCompilerPassName =
  | "DefinitionValidation"
  | "CanonicalOrdering"
  | "Normalization"
  | "DependencyResolution"
  | "ConflictAnalysis"
  | "DeterministicOptimization"
  | "IdentityAssignment"
  | "PolicyIRGeneration"
  | "CompilationCertification";

export interface RuntimePolicyTargetDefinition {
  targetType: string;
  targetId?: string;
  selector?: Readonly<Record<string, RuntimePolicyPrimitive>>;
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyConditionDefinition {
  conditionId?: string;
  factKey: string;
  operator: RuntimePolicyConditionOperator;
  expectedValue?: unknown;
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyObligationDefinition {
  obligationId?: string;
  obligationType: string;
  payload: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyRuleDefinition {
  ruleId?: string;
  name: string;
  effect: RuntimePolicyEffect;
  priority?: number;
  target: RuntimePolicyTargetDefinition;
  conditions: readonly RuntimePolicyConditionDefinition[];
  obligations?: readonly RuntimePolicyObligationDefinition[];
  dependencyRuleIds?: readonly string[];
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyDefinition {
  policyDefinitionId?: string;
  name: string;
  version: string;
  lifecycleState: RuntimePolicyDefinitionLifecycle;
  schemaVersion: string;
  conflictStrategy?: RuntimePolicyConflictStrategy;
  policySetIds?: readonly string[];
  dependencyPolicyIds?: readonly string[];
  rules: readonly RuntimePolicyRuleDefinition[];
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyRuleIR {
  ruleId: string;
  ruleDigest: string;
  effect: RuntimePolicyEffect;
  priority: number;
  target: RuntimePolicyTargetDefinition;
  conditions: readonly RuntimePolicyConditionDefinition[];
  obligations: readonly RuntimePolicyObligationDefinition[];
  dependencyRuleIds: readonly string[];
  metadata: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyIR {
  runtimePolicyIrId: string;
  runtimePolicyIrDigest: string;
  policyDefinitionId: string;
  policyDefinitionDigest: string;
  schemaVersion: string;
  conflictStrategy: RuntimePolicyConflictStrategy;
  policySetIds: readonly string[];
  dependencyPolicyIds: readonly string[];
  rules: readonly RuntimePolicyRuleIR[];
  conflictMetadata: Readonly<Record<string, unknown>>;
  compilerId: string;
  compilerVersion: string;
}

export interface RuntimePolicyCompilationPassResult {
  passName: RuntimePolicyCompilerPassName;
  sequence: number;
  success: boolean;
  failureReason?: string;
  inputDigest: string;
  outputDigest: string;
  diagnosticsDigest: string;
  evidenceDigest: string;
}

export interface RuntimePolicyCompilationCertificate {
  certificateId: string;
  policyDefinitionId: string;
  policyDefinitionDigest: string;
  runtimePolicyIrId: string;
  runtimePolicyIrDigest: string;
  compilerId: string;
  compilerVersion: string;
  compilationSequence: number;
  validationResult: "Valid" | "Invalid";
  validationDigest: string;
  diagnosticsDigest: string;
  evidenceDigest: string;
  passResults: readonly RuntimePolicyCompilationPassResult[];
  schemaVersion: string;
  metadata: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyFact {
  factKey: string;
  factType: RuntimePolicyFactType;
  factValue: unknown;
  sourceKind: RuntimePolicyFactSourceKind;
  sourceId: string;
  sourceVersion: string;
  sourceDigest: string;
  confidence?: number;
  provenanceReferences?: readonly string[];
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyFactProvenance {
  sourceKind: RuntimePolicyFactSourceKind;
  sourceId: string;
  sourceVersion: string;
  sourceDigest: string;
  provenanceReferences: readonly string[];
}

export interface RuntimePolicyFactIR {
  factId: string;
  factKey: string;
  canonicalType: RuntimePolicyFactType;
  canonicalValue: unknown;
  provenance: RuntimePolicyFactProvenance;
  sourceDigest: string;
  provenanceDigest: string;
  confidence: number;
  schemaVersion: string;
}

export interface RuntimePolicyEvaluationContext {
  requestId: string;
  executionContextId: string;
  policyRuntimeId: string;
  tenantId?: string;
  principalReference?: string;
  schemaVersion: string;
  metadata?: Readonly<Record<string, RuntimePolicyPrimitive>>;
}

export interface RuntimePolicyDecisionTraceStep {
  sequence: number;
  phase: "Resolution" | "Evaluation" | "ConflictResolution" | "Decision";
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimePolicyDecisionTrace {
  traceId: string;
  decisionId: string;
  steps: readonly RuntimePolicyDecisionTraceStep[];
}

export interface RuntimePolicyDecision {
  decisionId: string;
  policyDefinitionId: string;
  runtimePolicyIrId: string;
  decision: RuntimePolicyDecisionType;
  matchedPolicyIds: readonly string[];
  matchedRuleIds: readonly string[];
  obligations: readonly RuntimePolicyObligationDefinition[];
  trace: RuntimePolicyDecisionTrace;
  factDigests: readonly string[];
  contextDigest: string;
}

export interface RuntimePolicyDiagnostic {
  sequence: number;
  level: RuntimePolicyLogLevel;
  code: string;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimePolicyEvidenceEntry {
  sequence: number;
  type: string;
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimePolicyTelemetrySnapshot {
  counters: Readonly<Record<string, number>>;
}

export interface RuntimePolicySnapshot {
  runtimePolicyIr: RuntimePolicyIR;
  certificate: RuntimePolicyCompilationCertificate;
  diagnostics: readonly RuntimePolicyDiagnostic[];
  evidence: readonly RuntimePolicyEvidenceEntry[];
  telemetry: RuntimePolicyTelemetrySnapshot;
}

export interface RuntimePolicySnapshotRecord {
  runtimeExecutionContextId: string;
  revision: number;
  snapshot: RuntimePolicySnapshot;
}

export interface RuntimePolicyReplayResult {
  replayDigest: string;
  matched: boolean;
  leftDecisionId: string;
  rightDecisionId: string;
  leftDecisionDigest: string;
  rightDecisionDigest: string;
  leftTraceDigest: string;
  rightTraceDigest: string;
  leftPolicyDigest: string;
  rightPolicyDigest: string;
  leftFactsDigest: string;
  rightFactsDigest: string;
}

export interface RuntimePolicyCompilerConfig {
  compilerId: string;
  compilerVersion: string;
  schemaVersion: string;
  runtimeExecutionContextId: string;
}

export interface RuntimePolicyCompilerState {
  definition: RuntimePolicyDefinition;
  definitionDigest: string;
  normalizedDefinition: RuntimePolicyDefinition;
  passResults: readonly RuntimePolicyCompilationPassResult[];
  diagnostics: readonly RuntimePolicyDiagnostic[];
  evidence: readonly RuntimePolicyEvidenceEntry[];
  conflictMetadata: Readonly<Record<string, unknown>>;
  generatedIds: Readonly<Record<string, string>>;
  failed: boolean;
  failureReason?: string;
  runtimePolicyIr?: RuntimePolicyIR;
  certificate?: RuntimePolicyCompilationCertificate;
}

export interface RuntimePolicyCompilationResult {
  success: boolean;
  validationResult: "Valid" | "Invalid";
  failureReason?: string;
  failureDigest?: string;
  failedPassName?: RuntimePolicyCompilerPassName;
  compilerId: string;
  compilerVersion: string;
  runtimePolicyIr?: RuntimePolicyIR;
  certificate?: RuntimePolicyCompilationCertificate;
  diagnostics: readonly RuntimePolicyDiagnostic[];
  evidence: readonly RuntimePolicyEvidenceEntry[];
  passResults: readonly RuntimePolicyCompilationPassResult[];
}

export interface RuntimePolicyResolutionRequest {
  policyRuntimeId: string;
  policyIrCandidates: readonly RuntimePolicyIR[];
  context: RuntimePolicyEvaluationContext;
}

export interface RuntimePolicyResolutionResult {
  runtimePolicyIr: RuntimePolicyIR;
  candidateCount: number;
  selectedBy: "ExactRuntimeId" | "MostRecentDeterministic";
}

export interface RuntimePolicyFactCompilationResult {
  factIr: RuntimePolicyFactIR;
  diagnostics: readonly RuntimePolicyDiagnostic[];
  evidence: readonly RuntimePolicyEvidenceEntry[];
}

export interface RuntimePolicyEvaluationRequest {
  runtimePolicyIr: RuntimePolicyIR;
  facts: readonly RuntimePolicyFactIR[];
  context: RuntimePolicyEvaluationContext;
}

export interface RuntimePolicyConflictInput {
  strategy: RuntimePolicyConflictStrategy;
  effects: readonly RuntimePolicyEffect[];
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function createDigest(value: unknown): string {
  return createHash("sha256").update(stableSerialize(value)).digest("hex");
}

export function stableStringArray(values: readonly string[] = []): readonly string[] {
  return Object.freeze([...new Set(values)].sort((a, b) => a.localeCompare(b)));
}

export function stablePrimitiveRecord(
  record: Readonly<Record<string, RuntimePolicyPrimitive>> = {},
): Readonly<Record<string, RuntimePolicyPrimitive>> {
  return deepFreeze(canonicalize(record) as Readonly<Record<string, RuntimePolicyPrimitive>>);
}

export function stableUnknownRecord(record: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return deepFreeze(canonicalize(record) as Readonly<Record<string, unknown>>);
}

export function normalizeConflictStrategy(strategy?: RuntimePolicyConflictStrategy): RuntimePolicyConflictStrategy {
  return strategy ?? "deny-overrides";
}

export function normalizePriority(priority: number | undefined, fallback: number): number {
  return Number.isFinite(priority) ? (priority as number) : fallback;
}

export function normalizeConfidence(confidence?: number): number {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return 1;
  }
  if (confidence < 0) {
    return 0;
  }
  if (confidence > 1) {
    return 1;
  }
  return confidence;
}
