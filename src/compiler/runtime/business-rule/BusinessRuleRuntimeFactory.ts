import { stableStringify } from "../../core/stableStringify";
import { SourceHash } from "../../provenance/SourceHash";
import { deepFreeze } from "../foundation/immutability";
import type {
  BusinessRuleCalculation,
  BusinessRuleCondition,
  BusinessRuleConditionResult,
  BusinessRuleDerivedFact,
  BusinessRuleDomain,
  BusinessRuleEvaluationInput,
  BusinessRuleEvaluationOutcome,
  BusinessRuleEvaluationStatus,
  BusinessRuleEvidenceLink,
  BusinessRuleProvenanceLink,
  BusinessRuleRuntimeCreateInput,
  BusinessRuleRuntimeFactoryOptions,
  BusinessRuleRuntimeObject,
  BusinessRuleRuntimeVersionChangeInput,
  BusinessRuleValidationResult,
  BusinessRuleValidator,
  EvidenceObservationStance,
} from "./contracts";

function hashFromObject(value: unknown): string {
  return SourceHash.sha256(stableStringify(value));
}

function normalizeText(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`Business rule ${fieldName} is required`);
  }

  return normalized;
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Business rule confidence must be between 0 and 1");
  }

  return Number(value.toFixed(6));
}

function normalizeUniqueText(values: readonly string[] | undefined): readonly string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))].sort();
}

function normalizeDomainCalculations(
  domain: BusinessRuleDomain,
  calculations: readonly BusinessRuleCalculation[] | undefined,
): readonly BusinessRuleCalculation[] {
  const rows = (calculations ?? []).map((calculation) => ({
    outputFactKey: normalizeText(calculation.outputFactKey, "calculation.outputFactKey"),
    operation: calculation.operation,
    operandFactKeys: normalizeUniqueText(calculation.operandFactKeys),
  }));

  if (domain === "CALCULATION" && rows.length === 0) {
    throw new Error("Calculation rules must include at least one calculation");
  }

  if (domain !== "CALCULATION" && rows.length > 0) {
    throw new Error("Only calculation rules may define calculations");
  }

  return rows.sort((left, right) => left.outputFactKey.localeCompare(right.outputFactKey));
}

function normalizeConditions(conditions: readonly BusinessRuleCondition[]): readonly BusinessRuleCondition[] {
  const rows = conditions.map((condition) => ({
    factKey: normalizeText(condition.factKey, "condition.factKey"),
    operator: condition.operator,
    expectedValue: condition.expectedValue,
  }));

  if (rows.length === 0) {
    throw new Error("Business rules require at least one condition");
  }

  return rows.sort((left, right) => {
    const leftKey = `${left.factKey}:${left.operator}:${stableStringify(left.expectedValue)}`;
    const rightKey = `${right.factKey}:${right.operator}:${stableStringify(right.expectedValue)}`;
    return leftKey.localeCompare(rightKey);
  });
}

function normalizeProvenance(
  ruleSeed: Readonly<Record<string, unknown>>,
  provenance: readonly Omit<BusinessRuleProvenanceLink, "provenanceId">[] | undefined,
): readonly BusinessRuleProvenanceLink[] {
  const rows = (provenance ?? [])
    .map((row) => ({
      sourceSystem: normalizeText(row.sourceSystem, "provenance.sourceSystem"),
      sourceLocator: normalizeText(row.sourceLocator, "provenance.sourceLocator"),
      recordedAt: normalizeText(row.recordedAt, "provenance.recordedAt"),
    }))
    .sort((left, right) => {
      const leftKey = `${left.recordedAt}:${left.sourceSystem}:${left.sourceLocator}`;
      const rightKey = `${right.recordedAt}:${right.sourceSystem}:${right.sourceLocator}`;
      return leftKey.localeCompare(rightKey);
    });

  return rows.map((row) => ({
    provenanceId: hashFromObject({ ruleSeed, ...row }),
    sourceSystem: row.sourceSystem,
    sourceLocator: row.sourceLocator,
    recordedAt: row.recordedAt,
  }));
}

function normalizeEvidenceLinks(evidenceLinks: readonly BusinessRuleEvidenceLink[] | undefined): readonly BusinessRuleEvidenceLink[] {
  return [...(evidenceLinks ?? [])]
    .map((link) => ({
      evidenceId: normalizeText(link.evidenceId, "evidenceLink.evidenceId"),
      validationId: normalizeText(link.validationId, "evidenceLink.validationId"),
      certificationId: normalizeText(link.certificationId, "evidenceLink.certificationId"),
      stance: link.stance,
    }))
    .sort((left, right) => {
      const leftKey = `${left.evidenceId}:${left.validationId}:${left.certificationId}:${left.stance}`;
      const rightKey = `${right.evidenceId}:${right.validationId}:${right.certificationId}:${right.stance}`;
      return leftKey.localeCompare(rightKey);
    });
}

function compareValue(actualValue: unknown, expectedValue: unknown, operator: BusinessRuleCondition["operator"]): boolean {
  if (operator === "EXISTS") {
    return actualValue !== undefined && actualValue !== null;
  }

  if (operator === "NOT_EXISTS") {
    return actualValue === undefined || actualValue === null;
  }

  if (operator === "EQ") {
    return stableStringify(actualValue) === stableStringify(expectedValue);
  }

  if (operator === "NEQ") {
    return stableStringify(actualValue) !== stableStringify(expectedValue);
  }

  if (operator === "IN") {
    return Array.isArray(expectedValue) && expectedValue.some((candidate) => stableStringify(candidate) === stableStringify(actualValue));
  }

  if (operator === "NOT_IN") {
    return Array.isArray(expectedValue) && expectedValue.every((candidate) => stableStringify(candidate) !== stableStringify(actualValue));
  }

  if (typeof actualValue !== "number" || typeof expectedValue !== "number") {
    return false;
  }

  if (operator === "GT") {
    return actualValue > expectedValue;
  }

  if (operator === "GTE") {
    return actualValue >= expectedValue;
  }

  if (operator === "LT") {
    return actualValue < expectedValue;
  }

  if (operator === "LTE") {
    return actualValue <= expectedValue;
  }

  return false;
}

function evaluateCalculation(calculation: BusinessRuleCalculation, facts: Readonly<Record<string, unknown>>): number | undefined {
  const operands = calculation.operandFactKeys
    .map((operandFactKey) => facts[operandFactKey])
    .filter((value): value is number => typeof value === "number");

  if (operands.length !== calculation.operandFactKeys.length || operands.length === 0) {
    return undefined;
  }

  if (calculation.operation === "SUM") {
    return Number(operands.reduce((accumulator, value) => accumulator + value, 0).toFixed(6));
  }

  if (calculation.operation === "MULTIPLY") {
    return Number(operands.reduce((accumulator, value) => accumulator * value, 1).toFixed(6));
  }

  if (calculation.operation === "MIN") {
    return Number(Math.min(...operands).toFixed(6));
  }

  return Number(Math.max(...operands).toFixed(6));
}

function deriveStatus(
  conditionResults: readonly BusinessRuleConditionResult[],
  contradictoryEvidenceIds: readonly string[],
): BusinessRuleEvaluationStatus {
  if (contradictoryEvidenceIds.length > 0) {
    return "CONTRADICTED";
  }

  const hasUnresolved = conditionResults.some((result) => result.status === "unresolved");
  if (hasUnresolved) {
    return "UNRESOLVED";
  }

  const hasFailures = conditionResults.some((result) => result.status === "fail");
  if (hasFailures) {
    return "FAIL";
  }

  return "PASS";
}

export class BusinessRuleRuntimeFactory {
  private readonly clock: () => string;

  private readonly configuration: BusinessRuleRuntimeFactoryOptions["configuration"];

  public constructor(options: BusinessRuleRuntimeFactoryOptions) {
    this.configuration = deepFreeze({ ...options.configuration });
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  public createRule(input: BusinessRuleRuntimeCreateInput): BusinessRuleRuntimeObject {
    const createdAt = this.clock();
    const canonicalCode = normalizeText(input.canonicalCode, "canonicalCode").toUpperCase();
    const title = normalizeText(input.title, "title");
    const description = input.description?.trim();
    const confidence = normalizeConfidence(input.confidence);
    const conditions = normalizeConditions(input.conditions);
    const calculations = normalizeDomainCalculations(input.domain, input.calculations);
    const entityLinks = normalizeUniqueText(input.entityLinks);
    const relationshipLinks = normalizeUniqueText(input.relationshipLinks);

    const replayId = normalizeText(input.replayLink.replayId, "replayLink.replayId");
    const sourceManifestId = normalizeText(input.replayLink.sourceManifestId, "replayLink.sourceManifestId");

    const seed = {
      canonicalCode,
      title,
      description,
      domain: input.domain,
      conditions,
      calculations,
      runtimeId: this.configuration.runtimeId,
      compilerVersion: this.configuration.compilerVersion,
      specificationVersion: this.configuration.specificationVersion,
      programVersion: this.configuration.programVersion,
      schemaVersion: this.configuration.schemaVersion,
      entityLinks,
      relationshipLinks,
    };

    const ruleId = hashFromObject(seed);
    const evidenceLinks = normalizeEvidenceLinks(input.evidenceLinks);
    const provenance = normalizeProvenance(seed, input.provenance);

    const version = {
      versionId: hashFromObject({ ruleId, ordinal: 1, schemaVersion: this.configuration.schemaVersion, reason: "initial creation" }),
      ordinal: 1,
      schemaVersion: this.configuration.schemaVersion,
      reason: "initial creation",
      createdAt,
    };

    const lineage = {
      lineageId: hashFromObject({ ruleId, rootRuleId: ruleId, versionId: version.versionId }),
      rootRuleId: ruleId,
      appendOnly: true as const,
    };

    const rule: BusinessRuleRuntimeObject = {
      objectId: hashFromObject({ ruleId, versionId: version.versionId }),
      identity: {
        ruleId,
        identityVersion: hashFromObject({ ruleId, schemaVersion: this.configuration.schemaVersion }),
        canonicalCode,
      },
      title,
      description,
      domain: input.domain,
      conditions,
      calculations,
      confidence,
      provenance,
      evidenceLinks,
      entityLinks,
      relationshipLinks,
      replayLink: {
        replayId,
        sourceManifestId,
        deterministicFingerprint: hashFromObject({ ruleId, replayId, sourceManifestId, versionId: version.versionId }),
      },
      lifecycle: {
        currentState: "ACTIVE",
        history: [
          {
            state: "DECLARED",
            at: createdAt,
            reason: "Business rule created",
          },
          {
            state: "ACTIVE",
            at: createdAt,
            reason: "Business rule activated",
          },
        ],
      },
      lineage,
      version,
      createdAt,
      updatedAt: createdAt,
    };

    return deepFreeze(rule);
  }

  public createNextVersion(current: BusinessRuleRuntimeObject, input: BusinessRuleRuntimeVersionChangeInput): BusinessRuleRuntimeObject {
    const createdAt = this.clock();
    const nextOrdinal = current.version.ordinal + 1;
    const lifecycleState = input.lifecycleTransition ?? "ACTIVE";

    const version = {
      versionId: hashFromObject({
        ruleId: current.identity.ruleId,
        ordinal: nextOrdinal,
        schemaVersion: this.configuration.schemaVersion,
        previousVersionId: current.version.versionId,
        reason: input.reason,
      }),
      ordinal: nextOrdinal,
      previousVersionId: current.version.versionId,
      schemaVersion: this.configuration.schemaVersion,
      reason: input.reason,
      createdAt,
    };

    const normalizedConfidence = input.confidence === undefined ? current.confidence : normalizeConfidence(input.confidence);

    const next: BusinessRuleRuntimeObject = {
      ...current,
      objectId: hashFromObject({ ruleId: current.identity.ruleId, versionId: version.versionId }),
      confidence: normalizedConfidence,
      lifecycle: {
        currentState: lifecycleState,
        history: [
          ...current.lifecycle.history,
          {
            state: lifecycleState,
            at: createdAt,
            reason: input.reason,
          },
        ],
      },
      lineage: {
        lineageId: hashFromObject({
          rootRuleId: current.lineage.rootRuleId,
          parentVersionId: current.version.versionId,
          nextVersionId: version.versionId,
        }),
        rootRuleId: current.lineage.rootRuleId,
        parentVersionId: current.version.versionId,
        supersedesVersionId: lifecycleState === "SUPERSEDED" ? current.version.versionId : current.lineage.supersedesVersionId,
        retiredVersionId: lifecycleState === "RETIRED" ? current.version.versionId : current.lineage.retiredVersionId,
        appendOnly: true,
      },
      version,
      updatedAt: createdAt,
    };

    return deepFreeze(next);
  }

  public evaluateRule(rule: BusinessRuleRuntimeObject, input: BusinessRuleEvaluationInput): BusinessRuleEvaluationOutcome {
    const evaluatedAt = this.clock();
    const orderedFacts = Object.fromEntries(Object.entries(input.facts).sort(([left], [right]) => left.localeCompare(right)));

    const conditionResults = rule.conditions.map<BusinessRuleConditionResult>((condition) => {
      const actualValue = orderedFacts[condition.factKey];
      if (actualValue === undefined && condition.operator !== "EXISTS" && condition.operator !== "NOT_EXISTS") {
        return {
          factKey: condition.factKey,
          operator: condition.operator,
          expectedValue: condition.expectedValue,
          status: "unresolved",
        };
      }

      const passed = compareValue(actualValue, condition.expectedValue, condition.operator);
      return {
        factKey: condition.factKey,
        operator: condition.operator,
        expectedValue: condition.expectedValue,
        actualValue,
        status: passed ? "pass" : "fail",
      };
    });

    const contradictoryEvidenceIds = normalizeUniqueText(input.contradictoryEvidenceIds).filter((evidenceId) =>
      rule.evidenceLinks.some((link) => link.evidenceId === evidenceId),
    );

    const factsWithDerived: Record<string, unknown> = { ...orderedFacts };
    const derivedRows: BusinessRuleDerivedFact[] = [];
    for (const calculation of rule.calculations) {
      const value = evaluateCalculation(calculation, factsWithDerived);
      if (value !== undefined) {
        factsWithDerived[calculation.outputFactKey] = value;
        derivedRows.push({
          factKey: calculation.outputFactKey,
          value,
        });
      }
    }

    const derivedFacts = derivedRows.sort((left, right) => left.factKey.localeCompare(right.factKey));

    const status = deriveStatus(conditionResults, contradictoryEvidenceIds);

    return deepFreeze({
      status,
      conditionResults: deepFreeze(conditionResults),
      derivedFacts: deepFreeze(derivedFacts),
      contradictoryEvidenceIds,
      confidence: rule.confidence,
      replayLink: rule.replayLink,
      evidenceLinks: rule.evidenceLinks,
      entityLinks: rule.entityLinks,
      relationshipLinks: rule.relationshipLinks,
      provenance: rule.provenance,
      lineage: rule.lineage,
      evaluatedAt,
    });
  }

  public validateRule(
    rule: BusinessRuleRuntimeObject,
    validators: readonly BusinessRuleValidator[],
  ): readonly BusinessRuleValidationResult[] {
    const checkedAt = this.clock();
    const ordered = [...validators].sort((left, right) => left.name.localeCompare(right.name));

    const results = ordered.map((validator) => {
      try {
        const result = validator.validate(rule);
        return {
          validatorName: validator.name,
          status: result.status,
          code: result.code,
          message: result.message,
          checkedAt,
        } as BusinessRuleValidationResult;
      } catch (error) {
        return {
          validatorName: validator.name,
          status: "fail",
          code: "VALIDATOR_EXCEPTION",
          message: error instanceof Error ? error.message : "Validator threw unknown error",
          checkedAt,
        } as BusinessRuleValidationResult;
      }
    });

    return deepFreeze(results);
  }

  public createDomainGuardValidator(domain: BusinessRuleDomain): BusinessRuleValidator {
    return {
      name: `${domain.toLowerCase()}-domain-guard`,
      validate: (rule) => {
        if (rule.domain !== domain) {
          return {
            status: "fail",
            code: "DOMAIN_MISMATCH",
            message: `Expected ${domain} rule`,
          };
        }

        return {
          status: "pass",
          code: "DOMAIN_OK",
          message: `${domain} rule validated`,
        };
      },
    };
  }

  public createContradictionPreservationValidator(): BusinessRuleValidator {
    return {
      name: "contradiction-preservation",
      validate: (rule) => {
        const stances = new Set<EvidenceObservationStance>(rule.evidenceLinks.map((link) => link.stance));
        if (stances.has("supporting") && stances.has("contradicting")) {
          return {
            status: "warn",
            code: "CONTRADICTION_PRESERVED",
            message: "Conflicting evidence stances are preserved without resolution",
          };
        }

        return {
          status: "pass",
          code: "CONTRADICTION_OK",
          message: "No contradictory evidence stances detected",
        };
      },
    };
  }
}
