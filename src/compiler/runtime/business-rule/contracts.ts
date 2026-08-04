export type BusinessRuleDomain = "VALIDATION" | "COMPLIANCE" | "ELIGIBILITY" | "POLICY" | "CALCULATION";

export type BusinessRuleOperator =
  | "EQ"
  | "NEQ"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IN"
  | "NOT_IN"
  | "EXISTS"
  | "NOT_EXISTS";

export type BusinessRuleEvaluationStatus = "PASS" | "FAIL" | "WARN" | "UNRESOLVED" | "CONTRADICTED";

export type BusinessRuleLifecycleState = "DECLARED" | "ACTIVE" | "SUPERSEDED" | "RETIRED";

export type BusinessRuleCalculationOperation = "SUM" | "MULTIPLY" | "MIN" | "MAX";

export type EvidenceObservationStance = "supporting" | "contradicting" | "unknown";

export interface BusinessRuleLifecycleEvent {
  readonly state: BusinessRuleLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface BusinessRuleLifecycle {
  readonly currentState: BusinessRuleLifecycleState;
  readonly history: readonly BusinessRuleLifecycleEvent[];
}

export interface BusinessRuleIdentity {
  readonly ruleId: string;
  readonly identityVersion: string;
  readonly canonicalCode: string;
}

export interface BusinessRuleCondition {
  readonly factKey: string;
  readonly operator: BusinessRuleOperator;
  readonly expectedValue?: unknown;
}

export interface BusinessRuleCalculation {
  readonly outputFactKey: string;
  readonly operation: BusinessRuleCalculationOperation;
  readonly operandFactKeys: readonly string[];
}

export interface BusinessRuleProvenanceLink {
  readonly provenanceId: string;
  readonly sourceSystem: string;
  readonly sourceLocator: string;
  readonly recordedAt: string;
}

export interface BusinessRuleEvidenceLink {
  readonly evidenceId: string;
  readonly validationId: string;
  readonly certificationId: string;
  readonly stance: EvidenceObservationStance;
}

export interface BusinessRuleReplayLink {
  readonly replayId: string;
  readonly sourceManifestId: string;
  readonly deterministicFingerprint: string;
}

export interface BusinessRuleLineage {
  readonly lineageId: string;
  readonly rootRuleId: string;
  readonly parentVersionId?: string;
  readonly supersedesVersionId?: string;
  readonly retiredVersionId?: string;
  readonly appendOnly: true;
}

export interface BusinessRuleVersion {
  readonly versionId: string;
  readonly ordinal: number;
  readonly previousVersionId?: string;
  readonly schemaVersion: string;
  readonly reason: string;
  readonly createdAt: string;
}

export interface BusinessRuleRuntimeObject {
  readonly objectId: string;
  readonly identity: BusinessRuleIdentity;
  readonly title: string;
  readonly description?: string;
  readonly domain: BusinessRuleDomain;
  readonly conditions: readonly BusinessRuleCondition[];
  readonly calculations: readonly BusinessRuleCalculation[];
  readonly confidence: number;
  readonly provenance: readonly BusinessRuleProvenanceLink[];
  readonly evidenceLinks: readonly BusinessRuleEvidenceLink[];
  readonly entityLinks: readonly string[];
  readonly relationshipLinks: readonly string[];
  readonly replayLink: BusinessRuleReplayLink;
  readonly lifecycle: BusinessRuleLifecycle;
  readonly lineage: BusinessRuleLineage;
  readonly version: BusinessRuleVersion;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface BusinessRuleValidatorResult {
  readonly status: "pass" | "warn" | "fail";
  readonly code: string;
  readonly message: string;
}

export interface BusinessRuleValidationResult extends BusinessRuleValidatorResult {
  readonly validatorName: string;
  readonly checkedAt: string;
}

export interface BusinessRuleValidator {
  readonly name: string;
  validate(rule: BusinessRuleRuntimeObject): BusinessRuleValidatorResult;
}

export interface BusinessRuleRuntimeCreateInput {
  readonly canonicalCode: string;
  readonly title: string;
  readonly description?: string;
  readonly domain: BusinessRuleDomain;
  readonly conditions: readonly BusinessRuleCondition[];
  readonly calculations?: readonly BusinessRuleCalculation[];
  readonly confidence: number;
  readonly provenance?: readonly Omit<BusinessRuleProvenanceLink, "provenanceId">[];
  readonly evidenceLinks?: readonly BusinessRuleEvidenceLink[];
  readonly entityLinks?: readonly string[];
  readonly relationshipLinks?: readonly string[];
  readonly replayLink: {
    readonly replayId: string;
    readonly sourceManifestId: string;
  };
}

export interface BusinessRuleRuntimeVersionChangeInput {
  readonly reason: string;
  readonly lifecycleTransition?: "ACTIVE" | "SUPERSEDED" | "RETIRED";
  readonly confidence?: number;
}

export interface BusinessRuleEvaluationInput {
  readonly facts: Readonly<Record<string, unknown>>;
  readonly contradictoryEvidenceIds?: readonly string[];
}

export interface BusinessRuleConditionResult {
  readonly factKey: string;
  readonly operator: BusinessRuleOperator;
  readonly expectedValue?: unknown;
  readonly actualValue?: unknown;
  readonly status: "pass" | "fail" | "unresolved";
}

export interface BusinessRuleDerivedFact {
  readonly factKey: string;
  readonly value: number;
}

export interface BusinessRuleEvaluationOutcome {
  readonly status: BusinessRuleEvaluationStatus;
  readonly conditionResults: readonly BusinessRuleConditionResult[];
  readonly derivedFacts: readonly BusinessRuleDerivedFact[];
  readonly contradictoryEvidenceIds: readonly string[];
  readonly confidence: number;
  readonly replayLink: BusinessRuleReplayLink;
  readonly evidenceLinks: readonly BusinessRuleEvidenceLink[];
  readonly entityLinks: readonly string[];
  readonly relationshipLinks: readonly string[];
  readonly provenance: readonly BusinessRuleProvenanceLink[];
  readonly lineage: BusinessRuleLineage;
  readonly evaluatedAt: string;
}

export interface BusinessRuleRuntimeFactoryConfiguration {
  readonly runtimeId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly schemaVersion: string;
}

export interface BusinessRuleRuntimeFactoryOptions {
  readonly configuration: BusinessRuleRuntimeFactoryConfiguration;
  readonly clock?: () => string;
}

export interface BusinessRuleRuntimeRegistryOptions {
  readonly factory: {
    validateRule(
      rule: BusinessRuleRuntimeObject,
      validators: readonly BusinessRuleValidator[],
    ): readonly BusinessRuleValidationResult[];
  };
  readonly validators?: readonly BusinessRuleValidator[];
  readonly clock?: () => string;
}

export interface RegisteredBusinessRuleRuntime {
  readonly rule: BusinessRuleRuntimeObject;
  readonly validation: readonly BusinessRuleValidationResult[];
  readonly registeredAt: string;
}
