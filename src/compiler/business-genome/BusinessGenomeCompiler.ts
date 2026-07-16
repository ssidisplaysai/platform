import { stableStringify } from "../core/stableStringify";
import type {
  BusinessGenome,
  BusinessGenomeCompilationContext,
  BusinessGenomeCompilationMetrics,
  BusinessGenomeCompilationResult,
  BusinessGenomeCompilerOptions,
  BusinessGenomeIR,
  GenomeConfidence,
  GenomeConflict,
  GenomeConstraint,
  GenomeDiagnostic,
  GenomeEntity,
  GenomeEvent,
  GenomeLineage,
  GenomeMetric,
  GenomeObjective,
  GenomeObjectBase,
  GenomePolicy,
  GenomeProcess,
  GenomeProvenance,
  GenomeRelationship,
  GenomeResource,
  GenomeResponsibility,
  GenomeRole,
  GenomeRule,
  GenomeTemporalValidity,
  GenomeWorkflow,
  BusinessGenomeInput,
  GenomeCapability,
} from "./BusinessGenomeIR";
import type { KnowledgeConflict, KnowledgeEntity, KnowledgeFact, KnowledgeIR, KnowledgeRelationship } from "../knowledge/KnowledgeIR";
import { BusinessGenomeHasher } from "./BusinessGenomeHasher";
import { BusinessGenomeValidator } from "./BusinessGenomeValidator";
import { GenomeIdentityFactory } from "./GenomeIdentity";

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}

function sortByIdentity<T extends { identity: { id: string } }>(values: readonly T[]): T[] {
  return [...values].sort((a, b) => a.identity.id.localeCompare(b.identity.id));
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry as T);
    }
  }

  return value;
}

function classify(content: string): readonly string[] {
  const normalized = content.toLowerCase();
  const classes: string[] = [];

  if (normalized.includes("capability") || normalized.includes("can ")) classes.push("capability");
  if (normalized.includes("process") || normalized.includes("workflow") || normalized.includes("step")) classes.push("process");
  if (normalized.includes("policy") || normalized.includes("govern")) classes.push("policy");
  if (normalized.includes("rule") || normalized.includes("must") || normalized.includes("shall")) classes.push("rule");
  if (normalized.includes("role") || normalized.includes("owner") || normalized.includes("team")) classes.push("role");
  if (normalized.includes("responsib")) classes.push("responsibility");
  if (normalized.includes("resource") || normalized.includes("system") || normalized.includes("platform")) classes.push("resource");
  if (normalized.includes("event") || normalized.includes("trigger")) classes.push("event");
  if (normalized.includes("constraint") || normalized.includes("limit")) classes.push("constraint");
  if (normalized.includes("metric") || normalized.includes("kpi") || normalized.includes("measure")) classes.push("metric");
  if (normalized.includes("objective") || normalized.includes("goal")) classes.push("objective");

  return uniqueSorted(classes);
}

function buildConfidence(
  sourceConfidence: number,
  corroboration: number,
  diversity: number,
  conflictState: "resolved" | "unresolved" | "non_blocking" | "blocking",
  recencyScore: number,
  validationQuality: number,
  semanticCompleteness: number,
  relationshipConfidence: number,
): GenomeConfidence {
  const conflictPenalty = conflictState === "blocking" ? 0.4 : conflictState === "unresolved" ? 0.2 : conflictState === "non_blocking" ? 0.08 : 0;
  const combined = clamp(
    (sourceConfidence * 0.35)
      + (Math.min(corroboration, 5) / 5 * 0.08)
      + (Math.min(diversity, 5) / 5 * 0.08)
      + (recencyScore * 0.1)
      + (validationQuality * 0.12)
      + (semanticCompleteness * 0.12)
      + (relationshipConfidence * 0.15)
      - conflictPenalty,
  );

  return {
    initial: clamp(sourceConfidence),
    current: combined,
    method: "deterministic-genome-confidence-v1",
    factors: {
      sourceKnowledgeConfidence: clamp(sourceConfidence),
      corroboration,
      sourceDiversity: diversity,
      recency: recencyScore,
      validationQuality,
      semanticCompleteness,
      relationshipConfidence,
      conflictPenalty,
    },
    rationale: [
      `source=${clamp(sourceConfidence)}`,
      `corroboration=${corroboration}`,
      `diversity=${diversity}`,
      `recency=${recencyScore}`,
      `validation=${validationQuality}`,
      `completeness=${semanticCompleteness}`,
      `relationship=${relationshipConfidence}`,
      `conflictPenalty=${conflictPenalty}`,
    ],
  };
}

function inferTemporalScope(temporal: GenomeTemporalValidity): string {
  return `${temporal.validFrom}|${temporal.validTo ?? "open"}`;
}

function buildLineageFromKnowledge(
  sourceKnowledgeId: string,
  sourceEvidenceIds: readonly string[],
  sourceDocument: string | undefined,
  sourceInterviewId: string | undefined,
  validationResult: "valid" | "warning" | "invalid" | "unknown",
  transformationVersion: string,
): GenomeLineage {
  return {
    sourceKnowledgeId,
    sourceEvidenceIds: uniqueSorted(sourceEvidenceIds),
    sourceDocument,
    sourceInterviewId,
    compilerStage: "stage-4-business-genome-compiler",
    transformationVersion,
    validationResult,
    transformationPath: ["stage-3-knowledge-compiler", "stage-4-business-genome-compiler"],
  };
}

function buildProvenanceFromKnowledge(
  sourceKnowledgeId: string,
  sourceEvidenceId: string,
  sourceEvidenceIdentity: string,
  sourceDocument: string | undefined,
  sourceInterviewId: string | undefined,
  sourceType: string | undefined,
  sourceOrigin: string | undefined,
  validationResult: "valid" | "warning" | "invalid" | "unknown",
  transformationVersion: string,
): GenomeProvenance {
  return {
    sourceKnowledgeId,
    sourceEvidenceId,
    sourceEvidenceIdentity,
    sourceDocument,
    sourceInterviewId,
    sourceType,
    sourceOrigin,
    compilerStage: "stage-4-business-genome-compiler",
    transformationVersion,
    validationResult,
  };
}

function fromKnowledgeTemporal(temporal: KnowledgeIR["entities"][number]["temporalValidity"], compiledAt: string): GenomeTemporalValidity {
  return {
    validFrom: temporal.validFrom,
    validTo: temporal.validTo,
    observedAt: temporal.observedAt,
    compiledAt,
    supersedes: temporal.supersedes,
    supersededBy: temporal.supersededBy,
  };
}

function buildBaseFromEntity(entity: KnowledgeEntity, compiledAt: string, transformationVersion: string): GenomeObjectBase {
  const entityConflictIds = uniqueSorted(
    Array.isArray((entity as unknown as { conflictIds?: readonly string[] }).conflictIds)
      ? ((entity as unknown as { conflictIds?: readonly string[] }).conflictIds ?? [])
      : [],
  );
  const temporalValidity = fromKnowledgeTemporal(entity.temporalValidity, compiledAt);
  const lineage = buildLineageFromKnowledge(
    entity.identity,
    entity.evidenceIds,
    entity.provenance.sourceDocument,
    entity.provenance.sourceInterviewId,
    entity.provenance.validationResult,
    transformationVersion,
  );
  const provenance = buildProvenanceFromKnowledge(
    entity.identity,
    entity.provenance.sourceEvidenceId,
    entity.provenance.sourceEvidenceIdentity,
    entity.provenance.sourceDocument,
    entity.provenance.sourceInterviewId,
    entity.provenance.sourceType,
    entity.provenance.sourceOrigin,
    entity.provenance.validationResult,
    transformationVersion,
  );

  const confidence = buildConfidence(
    entity.confidence.current,
    entity.evidenceIds.length,
    1,
    entityConflictIds.length > 0 ? "blocking" : "resolved",
    1,
    entity.provenance.validationResult === "valid" ? 1 : entity.provenance.validationResult === "warning" ? 0.5 : 0,
    1,
    0.8,
  );

  return {
    identity: GenomeIdentityFactory.generate({
      kind: "entity",
      objectType: entity.entityType,
      enterpriseScope: entity.provenance.sourceInterviewId ?? entity.provenance.sourceEvidenceId,
      relationshipScope: "entity",
      temporalScope: inferTemporalScope(temporalValidity),
      lineageSignature: stableStringify(lineage),
      versionSemantics: `${entity.version.semver}:${entity.version.revision}`,
      canonicalSemanticContent: {
        name: entity.canonicalName,
        content: entity.canonicalContent,
        facts: entity.factIds,
        relationships: entity.relationshipIds,
      },
    }),
    canonicalName: entity.canonicalName,
    canonicalContent: entity.canonicalContent,
    confidence,
    lineage,
    provenance,
    temporalValidity,
    version: {
      semver: entity.version.semver,
      revision: entity.version.revision,
      compiledAt,
      supersedes: entity.version.supersedes ?? null,
      supersededBy: entity.version.supersededBy ?? null,
    },
    conflictIds: entityConflictIds,
    metadata: entity.metadata,
  };
}

function buildBaseFromFact(fact: KnowledgeFact, compiledAt: string, transformationVersion: string): GenomeObjectBase {
  const temporalValidity = fromKnowledgeTemporal(fact.temporalValidity, compiledAt);
  const lineage = buildLineageFromKnowledge(
    fact.identity,
    fact.evidenceIds,
    fact.provenance.sourceDocument,
    fact.provenance.sourceInterviewId,
    fact.provenance.validationResult,
    transformationVersion,
  );
  const provenance = buildProvenanceFromKnowledge(
    fact.identity,
    fact.provenance.sourceEvidenceId,
    fact.provenance.sourceEvidenceIdentity,
    fact.provenance.sourceDocument,
    fact.provenance.sourceInterviewId,
    fact.provenance.sourceType,
    fact.provenance.sourceOrigin,
    fact.provenance.validationResult,
    transformationVersion,
  );

  return {
    identity: GenomeIdentityFactory.generate({
      kind: "fact",
      objectType: "knowledge-fact",
      enterpriseScope: fact.provenance.sourceInterviewId ?? fact.provenance.sourceEvidenceId,
      relationshipScope: fact.relationshipIds.join("|"),
      temporalScope: inferTemporalScope(temporalValidity),
      lineageSignature: stableStringify(lineage),
      versionSemantics: `${fact.version.semver}:${fact.version.revision}`,
      canonicalSemanticContent: {
        statement: fact.canonicalStatement,
        content: fact.canonicalContent,
      },
    }),
    canonicalName: fact.canonicalName,
    canonicalContent: fact.canonicalContent,
    confidence: buildConfidence(
      fact.confidence.current,
      fact.evidenceIds.length,
      1,
      fact.conflictIds.length > 0 ? "blocking" : "resolved",
      1,
      fact.provenance.validationResult === "valid" ? 1 : 0.5,
      1,
      0.8,
    ),
    lineage,
    provenance,
    temporalValidity,
    version: {
      semver: fact.version.semver,
      revision: fact.version.revision,
      compiledAt,
      supersedes: fact.version.supersedes ?? null,
      supersededBy: fact.version.supersededBy ?? null,
    },
    conflictIds: uniqueSorted(fact.conflictIds),
    metadata: {
      ...fact.metadata,
      subjectEntityId: fact.subjectEntityId,
      canonicalStatement: fact.canonicalStatement,
      evidenceNodeIds: fact.evidenceNodeIds,
    },
  };
}

function buildRelationship(
  relationship: KnowledgeRelationship,
  entityMap: Map<string, GenomeEntity>,
  compiledAt: string,
  transformationVersion: string,
): GenomeRelationship | null {
  const sourceEntity = entityMap.get(relationship.sourceEntityId);
  const targetEntity = entityMap.get(relationship.targetEntityId);
  if (!sourceEntity || !targetEntity) {
    return null;
  }

  const temporalValidity = fromKnowledgeTemporal(relationship.temporalValidity, compiledAt);
  const lineage = buildLineageFromKnowledge(
    relationship.identity,
    relationship.evidenceIds,
    relationship.provenance.sourceDocument,
    relationship.provenance.sourceInterviewId,
    relationship.provenance.validationResult,
    transformationVersion,
  );

  const base: GenomeObjectBase = {
    identity: GenomeIdentityFactory.generate({
      kind: "relationship",
      objectType: relationship.relationshipType,
      enterpriseScope: relationship.provenance.sourceInterviewId ?? relationship.provenance.sourceEvidenceId,
      relationshipScope: `${sourceEntity.identity.id}->${targetEntity.identity.id}`,
      temporalScope: inferTemporalScope(temporalValidity),
      lineageSignature: stableStringify(lineage),
      versionSemantics: `${relationship.version.semver}:${relationship.version.revision}`,
      canonicalSemanticContent: {
        sourceEntity: sourceEntity.identity.id,
        targetEntity: targetEntity.identity.id,
        relationshipType: relationship.relationshipType,
      },
    }),
    canonicalName: relationship.canonicalName,
    canonicalContent: relationship.canonicalContent,
    confidence: buildConfidence(
      relationship.confidence.current,
      relationship.evidenceIds.length,
      1,
      relationship.conflictIds.length > 0 ? "blocking" : "resolved",
      1,
      relationship.provenance.validationResult === "valid" ? 1 : 0.5,
      1,
      relationship.confidence.current,
    ),
    lineage,
    provenance: buildProvenanceFromKnowledge(
      relationship.identity,
      relationship.provenance.sourceEvidenceId,
      relationship.provenance.sourceEvidenceIdentity,
      relationship.provenance.sourceDocument,
      relationship.provenance.sourceInterviewId,
      relationship.provenance.sourceType,
      relationship.provenance.sourceOrigin,
      relationship.provenance.validationResult,
      transformationVersion,
    ),
    temporalValidity,
    version: {
      semver: relationship.version.semver,
      revision: relationship.version.revision,
      compiledAt,
      supersedes: relationship.version.supersedes ?? null,
      supersededBy: relationship.version.supersededBy ?? null,
    },
    conflictIds: uniqueSorted(relationship.conflictIds),
    metadata: relationship.metadata,
  };

  return {
    ...base,
    relationshipType: relationship.relationshipType,
    sourceEntityId: sourceEntity.identity.id,
    targetEntityId: targetEntity.identity.id,
  };
}

function mapConflictType(conflict: KnowledgeConflict): GenomeConflict["conflictType"] {
  switch (conflict.conflictType) {
    case "duplicate_claim":
      return "capability_ambiguity";
    case "contradictory_fact":
      return "incompatible_rule";
    case "temporal_disagreement":
      return "temporal_disagreement";
    case "confidence_disagreement":
      return "process_disagreement";
    case "entity_ambiguity":
      return "entity_ambiguity";
    default:
      return "generic_conflict";
  }
}

export class BusinessGenomeCompiler {
  private readonly hasher = new BusinessGenomeHasher();
  private readonly validator = new BusinessGenomeValidator();

  compile(input: BusinessGenomeInput, options: BusinessGenomeCompilerOptions = {}): BusinessGenomeIR {
    return this.compileWithResult(input, options).businessGenomeIR;
  }

  compileWithResult(input: BusinessGenomeInput, options: BusinessGenomeCompilerOptions = {}): BusinessGenomeCompilationResult {
    const compilerVersion = options.compilerVersion ?? "1.0.0";
    const pipelineVersion = options.pipelineVersion ?? "1.0.0";
    const compiledAt = options.compiledAt ?? input.generatedAt;
    const transformationVersion = "1.0.0";

    const entitiesInput = [...(input.entities ?? [])].sort((a, b) => a.identity.localeCompare(b.identity));
    const factsInput = [...(input.facts ?? [])].sort((a, b) => a.identity.localeCompare(b.identity));
    const relationshipsInput = [...(input.relationships ?? [])].sort((a, b) => a.identity.localeCompare(b.identity));
    const conflictsInput = [...(input.conflicts ?? [])].sort((a, b) => a.identity.localeCompare(b.identity));

    const diagnostics: GenomeDiagnostic[] = [];

    const entities = sortByIdentity(entitiesInput.map((entity) => ({
      ...buildBaseFromEntity(entity, compiledAt, transformationVersion),
      entityType: entity.entityType,
    })));

    const entityByKnowledgeId = new Map<string, GenomeEntity>(entitiesInput.map((entity, index) => [entity.identity, entities[index]]));

    const relationships: GenomeRelationship[] = sortByIdentity(
      relationshipsInput
        .map((relationship) => buildRelationship(relationship, entityByKnowledgeId, compiledAt, transformationVersion))
        .filter((entry): entry is GenomeRelationship => Boolean(entry)),
    );

    const allFactsBase = factsInput.map((fact) => buildBaseFromFact(fact, compiledAt, transformationVersion));

    const capabilities: GenomeCapability[] = [];
    const processes: GenomeProcess[] = [];
    const policies: GenomePolicy[] = [];
    const rules: GenomeRule[] = [];
    const roles: GenomeRole[] = [];
    const responsibilities: GenomeResponsibility[] = [];
    const resources: GenomeResource[] = [];
    const events: GenomeEvent[] = [];
    const constraints: GenomeConstraint[] = [];
    const metricObjects: GenomeMetric[] = [];
    const objectives: GenomeObjective[] = [];

    for (const base of allFactsBase) {
      const classes = classify(`${base.canonicalName} ${base.canonicalContent}`);
      const primaryEntityId = entities.find((entity) => entity.lineage.sourceKnowledgeId === (base.metadata["subjectEntityId"] as string))?.identity.id
        ?? entities[0]?.identity.id
        ?? "";

      if (classes.includes("capability")) {
        capabilities.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "capability", objectType: "capability", canonicalSemanticContent: base.canonicalContent }), capabilityType: "operational", entityId: primaryEntityId });
      }
      if (classes.includes("process")) {
        processes.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "process", objectType: "process", canonicalSemanticContent: base.canonicalContent }), processType: "enterprise-process", relatedEntityIds: primaryEntityId ? [primaryEntityId] : [] });
      }
      if (classes.includes("policy")) {
        policies.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "policy", objectType: "policy", canonicalSemanticContent: base.canonicalContent }), policyType: "governance-policy", ruleIds: [] });
      }
      if (classes.includes("rule")) {
        rules.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "rule", objectType: "rule", canonicalSemanticContent: base.canonicalContent }), ruleType: "governance-rule", policyId: null });
      }
      if (classes.includes("role")) {
        roles.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "role", objectType: "role", canonicalSemanticContent: base.canonicalContent }), roleType: "enterprise-role", responsibilityIds: [] });
      }
      if (classes.includes("responsibility")) {
        const roleId = roles[0]?.identity.id ?? "";
        responsibilities.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "responsibility", objectType: "responsibility", canonicalSemanticContent: base.canonicalContent }), responsibilityType: "operational", roleId, processId: processes[0]?.identity.id ?? null });
      }
      if (classes.includes("resource")) {
        resources.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "resource", objectType: "resource", canonicalSemanticContent: base.canonicalContent }), resourceType: "enterprise-resource", ownerRoleId: roles[0]?.identity.id ?? null });
      }
      if (classes.includes("event")) {
        events.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "event", objectType: "event", canonicalSemanticContent: base.canonicalContent }), eventType: "workflow-event", workflowId: null });
      }
      if (classes.includes("constraint")) {
        constraints.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "constraint", objectType: "constraint", canonicalSemanticContent: base.canonicalContent }), constraintType: "business-constraint", constrainedObjectIds: primaryEntityId ? [primaryEntityId] : [] });
      }
      if (classes.includes("metric")) {
        metricObjects.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "metric", objectType: "metric", canonicalSemanticContent: base.canonicalContent }), metricType: "operational-metric", targetObjectIds: primaryEntityId ? [primaryEntityId] : [] });
      }
      if (classes.includes("objective")) {
        objectives.push({ ...base, identity: GenomeIdentityFactory.generate({ ...base.identity, kind: "objective", objectType: "objective", canonicalSemanticContent: base.canonicalContent }), objectiveType: "business-objective", metricIds: [] });
      }
    }

    const fallbackBase = allFactsBase[0] ?? entities[0];
    if (fallbackBase) {
      if (capabilities.length === 0) {
        capabilities.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "capability", objectType: "capability", canonicalSemanticContent: fallbackBase.canonicalContent }), capabilityType: "operational", entityId: entities[0]?.identity.id ?? "" });
      }
      if (processes.length === 0) {
        processes.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "process", objectType: "process", canonicalSemanticContent: fallbackBase.canonicalContent }), processType: "enterprise-process", relatedEntityIds: entities.slice(0, 1).map((entry) => entry.identity.id) });
      }
      if (policies.length === 0) {
        policies.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "policy", objectType: "policy", canonicalSemanticContent: fallbackBase.canonicalContent }), policyType: "governance-policy", ruleIds: [] });
      }
      if (rules.length === 0) {
        rules.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "rule", objectType: "rule", canonicalSemanticContent: fallbackBase.canonicalContent }), ruleType: "governance-rule", policyId: null });
      }
      if (roles.length === 0) {
        roles.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "role", objectType: "role", canonicalSemanticContent: fallbackBase.canonicalContent }), roleType: "enterprise-role", responsibilityIds: [] });
      }
      if (responsibilities.length === 0) {
        responsibilities.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "responsibility", objectType: "responsibility", canonicalSemanticContent: fallbackBase.canonicalContent }), responsibilityType: "operational", roleId: roles[0]?.identity.id ?? "", processId: processes[0]?.identity.id ?? null });
      }
      if (resources.length === 0) {
        resources.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "resource", objectType: "resource", canonicalSemanticContent: fallbackBase.canonicalContent }), resourceType: "enterprise-resource", ownerRoleId: roles[0]?.identity.id ?? null });
      }
      if (events.length === 0) {
        events.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "event", objectType: "event", canonicalSemanticContent: fallbackBase.canonicalContent }), eventType: "workflow-event", workflowId: null });
      }
      if (constraints.length === 0) {
        constraints.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "constraint", objectType: "constraint", canonicalSemanticContent: fallbackBase.canonicalContent }), constraintType: "business-constraint", constrainedObjectIds: entities.slice(0, 1).map((entry) => entry.identity.id) });
      }
      if (metricObjects.length === 0) {
        metricObjects.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "metric", objectType: "metric", canonicalSemanticContent: fallbackBase.canonicalContent }), metricType: "operational-metric", targetObjectIds: entities.slice(0, 1).map((entry) => entry.identity.id) });
      }
      if (objectives.length === 0) {
        objectives.push({ ...fallbackBase, identity: GenomeIdentityFactory.generate({ ...fallbackBase.identity, kind: "objective", objectType: "objective", canonicalSemanticContent: fallbackBase.canonicalContent }), objectiveType: "business-objective", metricIds: [] });
      }
    }

    const sortedRules = sortByIdentity(rules);
    const sortedPolicies = sortByIdentity(policies.map((policy) => ({ ...policy, ruleIds: sortedRules.map((rule) => rule.identity.id) })));
    const sortedRoles = sortByIdentity(roles.map((role) => ({
      ...role,
      responsibilityIds: responsibilities
        .filter((responsibility) => responsibility.roleId === role.identity.id || !responsibility.roleId)
        .map((responsibility) => responsibility.identity.id)
        .sort((a, b) => a.localeCompare(b)),
    })));
    const sortedResponsibilities = sortByIdentity(responsibilities.map((responsibility) => ({
      ...responsibility,
      roleId: responsibility.roleId || sortedRoles[0]?.identity.id || "",
      processId: responsibility.processId ?? processes[0]?.identity.id ?? null,
    })));

    const workflowSeed = allFactsBase[0] ?? entities[0];
    const workflows: GenomeWorkflow[] = workflowSeed
      ? sortByIdentity([{
          ...workflowSeed,
          identity: GenomeIdentityFactory.generate({
            kind: "workflow",
            objectType: "workflow",
            enterpriseScope: input.compilationContext?.sourceIds?.[0] ?? "enterprise",
            relationshipScope: "workflow",
            temporalScope: workflowSeed.temporalValidity.validFrom ?? compiledAt,
            lineageSignature: stableStringify(workflowSeed.lineage ?? {}),
            versionSemantics: "1.0.0",
            canonicalSemanticContent: {
              processIds: sortByIdentity(processes).map((entry) => entry.identity.id),
              eventIds: sortByIdentity(events).map((entry) => entry.identity.id),
            },
          }),
          canonicalName: "Primary Enterprise Workflow",
          canonicalContent: "Deterministic workflow assembled from process and event extractions",
          workflowType: "business-workflow",
          processIds: sortByIdentity(processes).map((entry) => entry.identity.id),
          eventIds: sortByIdentity(events).map((entry) => entry.identity.id),
        }])
      : [];

    const eventsWithWorkflow = sortByIdentity(events.map((event) => ({
      ...event,
      workflowId: workflows[0]?.identity.id ?? null,
    })));

    const metricsWithTargets = sortByIdentity(metricObjects.map((metric) => ({
      ...metric,
      targetObjectIds: metric.targetObjectIds.length > 0 ? metric.targetObjectIds : entities.slice(0, 1).map((entry) => entry.identity.id),
    })));

    const objectivesWithMetrics = sortByIdentity(objectives.map((objective) => ({
      ...objective,
      metricIds: metricsWithTargets.map((metric) => metric.identity.id),
    })));

    const conflicts: GenomeConflict[] = sortByIdentity(conflictsInput.map((conflict) => {
      const base = buildBaseFromFact({
        ...(factsInput[0] ?? {
          kind: "fact",
          knowledgeId: conflict.knowledgeId,
          identity: conflict.identity,
          canonicalName: conflict.canonicalName,
          canonicalContent: conflict.canonicalContent,
          evidenceIds: conflict.evidenceIds,
          provenance: conflict.provenance,
          lineage: conflict.lineage,
          confidence: conflict.confidence,
          temporalValidity: conflict.temporalValidity,
          version: conflict.version,
          metadata: conflict.metadata,
          subjectEntityId: "",
          canonicalStatement: conflict.canonicalContent,
          evidenceNodeIds: [],
          relationshipIds: [],
          conflictIds: [],
        }),
      }, compiledAt, transformationVersion);

      return {
        ...base,
        identity: GenomeIdentityFactory.generate({
          ...base.identity,
          kind: "conflict",
          objectType: conflict.conflictType,
          canonicalSemanticContent: {
            conflictType: conflict.conflictType,
            status: conflict.status,
            relatedObjectIds: [...conflict.entityIds, ...conflict.relationshipIds].sort(),
          },
        }),
        conflictType: mapConflictType(conflict),
        status: conflict.status,
        required: conflict.required,
        blocking: conflict.blocking,
        relatedObjectIds: uniqueSorted([...conflict.entityIds, ...conflict.relationshipIds]),
      };
    }));

    const businessGenome: BusinessGenome = {
      version: "1.0.0",
      generatedAt: compiledAt,
      entities,
      relationships,
      capabilities: sortByIdentity(capabilities),
      processes: sortByIdentity(processes),
      policies: sortedPolicies,
      rules: sortedRules,
      roles: sortedRoles,
      responsibilities: sortedResponsibilities,
      resources: sortByIdentity(resources),
      events: eventsWithWorkflow,
      workflows,
      constraints: sortByIdentity(constraints),
      metrics: metricsWithTargets,
      objectives: objectivesWithMetrics,
      conflicts,
    };

    const context: BusinessGenomeCompilationContext = {
      compilerVersion,
      pipelineVersion,
      compiledAt,
      sourceKnowledgeHash: input.deterministicHash,
      sourceKnowledgeCount: entitiesInput.length + factsInput.length + relationshipsInput.length,
      sourceTypes: uniqueSorted((input.sourceNodes ?? []).map((node) => node.sourceType)),
      sourceIds: uniqueSorted((input.sourceNodes ?? []).map((node) => node.sourceId)),
      deterministicRunId: `bg-run-${input.deterministicHash.slice(0, 12)}`,
    };

    const provisionalMetrics: BusinessGenomeCompilationMetrics = {
      inputKnowledgeEntities: entitiesInput.length,
      inputKnowledgeFacts: factsInput.length,
      inputKnowledgeRelationships: relationshipsInput.length,
      entitiesProjected: businessGenome.entities.length,
      relationshipsProjected: businessGenome.relationships.length,
      capabilitiesExtracted: businessGenome.capabilities.length,
      processesExtracted: businessGenome.processes.length,
      policiesExtracted: businessGenome.policies.length,
      rulesExtracted: businessGenome.rules.length,
      rolesExtracted: businessGenome.roles.length,
      responsibilitiesMapped: businessGenome.responsibilities.length,
      resourcesIdentified: businessGenome.resources.length,
      eventsIdentified: businessGenome.events.length,
      workflowsConstructed: businessGenome.workflows.length,
      constraintsIdentified: businessGenome.constraints.length,
      metricsIdentified: businessGenome.metrics.length,
      objectivesIdentified: businessGenome.objectives.length,
      conflictsPreserved: businessGenome.conflicts.length,
      blockingConflicts: businessGenome.conflicts.filter((entry) => entry.blocking).length,
      diagnosticsCount: 0,
      executionTimeMs: 0,
    };

    const placeholderIR: BusinessGenomeIR = {
      schemaVersion: "1.0.0",
      businessGenome,
      compilationContext: context,
      diagnostics,
      metrics: provisionalMetrics,
      deterministicHash: "",
      deterministicSerialization: "",
      compiledFromKnowledgeHash: input.deterministicHash,
      generatedAt: compiledAt,
    };

    const serialization = this.hasher.serialize(placeholderIR);
    const hash = this.hasher.hash({ ...placeholderIR, deterministicSerialization: serialization });
    const computedIR: BusinessGenomeIR = {
      ...placeholderIR,
      deterministicSerialization: serialization,
      deterministicHash: hash,
    };

    const validationDiagnostics = this.validator.validate(computedIR);
    diagnostics.push(...validationDiagnostics);

    const metrics: BusinessGenomeCompilationMetrics = {
      ...provisionalMetrics,
      diagnosticsCount: diagnostics.length,
      executionTimeMs: 0,
    };

    const finalIR: BusinessGenomeIR = deepFreeze({
      ...computedIR,
      diagnostics: diagnostics.sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
      metrics,
      deterministicSerialization: this.hasher.serialize({ ...computedIR, diagnostics, metrics }),
    });

    const finalHash = this.hasher.hash(finalIR);
    const frozenFinalIR = deepFreeze({ ...finalIR, deterministicHash: finalHash });

    const result: BusinessGenomeCompilationResult = {
      success: !this.validator.hasBlockingErrors(frozenFinalIR.diagnostics),
      businessGenomeIR: frozenFinalIR,
      diagnostics: frozenFinalIR.diagnostics,
      metrics: frozenFinalIR.metrics,
    };

    if (!result.success) {
      throw new Error(
        `Business Genome compilation failed: ${result.diagnostics
          .filter((entry) => entry.severity === "error")
          .map((entry) => `${entry.code} ${entry.message}`)
          .join("; ")}`,
      );
    }

    return result;
  }
}
