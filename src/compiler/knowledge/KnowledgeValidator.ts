import type {
  KnowledgeIR,
  KnowledgeTemporalValidity,
} from "./KnowledgeIR";
import type { KnowledgeGraph } from "./KnowledgeGraph";
import { KnowledgeGraphHasher } from "./KnowledgeGraphHasher";
import { KnowledgeIdentity } from "./KnowledgeIdentity";

export type KnowledgeValidationErrorCode =
  | "DUPLICATE_NODE_ID"
  | "DUPLICATE_RELATIONSHIP_ID"
  | "DUPLICATE_CLAIM_ID"
  | "DUPLICATE_KNOWLEDGE_RELATIONSHIP_ID"
  | "DUPLICATE_KNOWLEDGE_OBJECT_ID"
  | "MISSING_RELATIONSHIP_ENDPOINT"
  | "MISSING_CLAIM_SUBJECT"
  | "MISSING_EVIDENCE_REFERENCES"
  | "INVALID_CONFIDENCE"
  | "INVALID_LINEAGE"
  | "MISSING_PROVENANCE"
  | "INVALID_IDENTITY"
  | "INVALID_FACT"
  | "INVALID_ENTITY_REFERENCE"
  | "INVALID_CLUSTER"
  | "UNRESOLVED_REQUIRED_CONFLICT"
  | "TEMPORAL_INVALIDITY"
  | "NONDETERMINISTIC_ORDERING"
  | "CLAIM_COUNT_MISMATCH"
  | "MISSING_COMPILED_FROM_EVIDENCE_HASH"
  | "HASH_MISMATCH";

export class KnowledgeValidationError extends Error {
  readonly code: KnowledgeValidationErrorCode;

  constructor(code: KnowledgeValidationErrorCode, message: string) {
    super(message);
    this.name = "KnowledgeValidationError";
    this.code = code;
  }
}

function isValidConfidence(value: number): boolean {
  return value >= 0 && value <= 1 && !Number.isNaN(value);
}

export class KnowledgeValidator {
  private readonly hasher = new KnowledgeGraphHasher();

  private validateOrdering<T>(items: readonly T[], idSelector: (item: T) => string, label: string): void {
    const ids = items.map((item) => idSelector(item));
    const sorted = [...ids].sort((left, right) => left.localeCompare(right));

    if (ids.some((value, index) => value !== sorted[index])) {
      throw new KnowledgeValidationError("NONDETERMINISTIC_ORDERING", `Non-deterministic ordering detected in ${label}`);
    }
  }

  private validateTemporalValidity(validity: KnowledgeTemporalValidity, label: string): void {
    if (!validity.validFrom || !validity.observedAt || !validity.compiledAt) {
      throw new KnowledgeValidationError("TEMPORAL_INVALIDITY", `Temporal validity missing required fields for ${label}`);
    }

    if (validity.validTo && validity.validTo < validity.validFrom) {
      throw new KnowledgeValidationError("TEMPORAL_INVALIDITY", `Temporal validity window invalid for ${label}`);
    }
  }

  private validateProvenance(provenance: { sourceEvidenceId: string; sourceEvidenceIdentity: string }, label: string): void {
    if (!provenance.sourceEvidenceId || !provenance.sourceEvidenceIdentity) {
      throw new KnowledgeValidationError("MISSING_PROVENANCE", `Missing provenance for ${label}`);
    }
  }

  private validateLineage(lineage: { sourceEvidenceId: string; compilerVersion: string; compiledAt: string; stage: string; transformationSteps?: readonly string[] }, label: string): void {
    if (!lineage.sourceEvidenceId || !lineage.compilerVersion || !lineage.compiledAt || !lineage.stage) {
      throw new KnowledgeValidationError("INVALID_LINEAGE", `Invalid lineage for ${label}`);
    }

    if (lineage.transformationSteps && lineage.transformationSteps.length === 0) {
      throw new KnowledgeValidationError("INVALID_LINEAGE", `Incomplete lineage for ${label}`);
    }
  }

  private validateKnowledgeObjects(ir: KnowledgeIR): void {
    const entities = ir.entities ?? [];
    const facts = ir.facts ?? [];
    const relationships = ir.relationships ?? [];
    const clusters = ir.clusters ?? [];
    const conflicts = ir.conflicts ?? [];

    this.validateOrdering(entities, (entity) => entity.identity, "entities");
    this.validateOrdering(facts, (fact) => fact.identity, "facts");
    this.validateOrdering(relationships, (relationship) => relationship.identity, "relationships");
    this.validateOrdering(clusters, (cluster) => cluster.identity, "clusters");
    this.validateOrdering(conflicts, (conflict) => conflict.identity, "conflicts");

    const entityIds = new Set<string>();
    const factIds = new Set<string>();
    const relationshipIds = new Set<string>();

    for (const entity of entities) {
      if (entityIds.has(entity.identity)) {
        throw new KnowledgeValidationError("DUPLICATE_KNOWLEDGE_OBJECT_ID", `Duplicate entity id: ${entity.identity}`);
      }

      entityIds.add(entity.identity);
      if (!KnowledgeIdentity.isValid(entity.knowledgeId) || !entity.identity) {
        throw new KnowledgeValidationError("INVALID_IDENTITY", `Invalid entity identity: ${entity.identity}`);
      }

      this.validateProvenance(entity.provenance, `entity ${entity.identity}`);
      this.validateLineage(entity.lineage, `entity ${entity.identity}`);
      this.validateTemporalValidity(entity.temporalValidity, `entity ${entity.identity}`);
    }

    for (const fact of facts) {
      if (factIds.has(fact.identity)) {
        throw new KnowledgeValidationError("DUPLICATE_KNOWLEDGE_OBJECT_ID", `Duplicate fact id: ${fact.identity}`);
      }

      factIds.add(fact.identity);
      if (!entityIds.has(fact.subjectEntityId)) {
        throw new KnowledgeValidationError("INVALID_ENTITY_REFERENCE", `Fact references missing entity: ${fact.subjectEntityId}`);
      }

      if (!fact.canonicalStatement || !fact.canonicalContent) {
        throw new KnowledgeValidationError("INVALID_FACT", `Malformed fact: ${fact.identity}`);
      }

      this.validateProvenance(fact.provenance, `fact ${fact.identity}`);
      this.validateLineage(fact.lineage, `fact ${fact.identity}`);
      this.validateTemporalValidity(fact.temporalValidity, `fact ${fact.identity}`);
    }

    for (const relationship of relationships) {
      if (relationshipIds.has(relationship.identity)) {
        throw new KnowledgeValidationError("DUPLICATE_KNOWLEDGE_RELATIONSHIP_ID", `Duplicate relationship id: ${relationship.identity}`);
      }

      relationshipIds.add(relationship.identity);

      if (!entityIds.has(relationship.sourceEntityId) || !entityIds.has(relationship.targetEntityId)) {
        throw new KnowledgeValidationError("INVALID_ENTITY_REFERENCE", `Relationship references missing entity: ${relationship.identity}`);
      }

      this.validateProvenance(relationship.provenance, `relationship ${relationship.identity}`);
      this.validateLineage(relationship.lineage, `relationship ${relationship.identity}`);
      this.validateTemporalValidity(relationship.temporalValidity, `relationship ${relationship.identity}`);
    }

    for (const cluster of clusters) {
      if (!cluster.entityIds.length || !cluster.factIds.length || !cluster.evidenceIds.length) {
        throw new KnowledgeValidationError("INVALID_CLUSTER", `Invalid cluster: ${cluster.identity}`);
      }

      this.validateProvenance(cluster.provenance, `cluster ${cluster.identity}`);
      this.validateLineage(cluster.lineage, `cluster ${cluster.identity}`);
      this.validateTemporalValidity(cluster.temporalValidity, `cluster ${cluster.identity}`);
    }

    for (const conflict of conflicts) {
      if (conflict.required && conflict.blocking && conflict.status !== "resolved") {
        throw new KnowledgeValidationError("UNRESOLVED_REQUIRED_CONFLICT", `Unresolved required conflict: ${conflict.identity}`);
      }

      this.validateProvenance(conflict.provenance, `conflict ${conflict.identity}`);
      this.validateLineage(conflict.lineage, `conflict ${conflict.identity}`);
      this.validateTemporalValidity(conflict.temporalValidity, `conflict ${conflict.identity}`);
    }
  }

  validateGraph(graph: KnowledgeGraph): void {
    const nodeIds = new Set<string>();

    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        throw new KnowledgeValidationError("DUPLICATE_NODE_ID", `Duplicate node id: ${node.id}`);
      }

      nodeIds.add(node.id);

      if (!isValidConfidence(node.confidence)) {
        throw new KnowledgeValidationError("INVALID_CONFIDENCE", `Invalid node confidence: ${node.id}`);
      }

      if (
        !node.lineage ||
        !Array.isArray(node.lineage.parentKnowledgeNodeIds) ||
        !Array.isArray(node.lineage.parentEvidenceNodeIds) ||
        !Array.isArray(node.lineage.transformationSteps)
      ) {
        throw new KnowledgeValidationError("INVALID_LINEAGE", `Invalid node lineage: ${node.id}`);
      }
    }

    const relationshipIds = new Set<string>();

    for (const relationship of graph.relationships) {
      if (relationshipIds.has(relationship.id)) {
        throw new KnowledgeValidationError(
          "DUPLICATE_RELATIONSHIP_ID",
          `Duplicate relationship id: ${relationship.id}`,
        );
      }

      relationshipIds.add(relationship.id);

      if (!nodeIds.has(relationship.from) || !nodeIds.has(relationship.to)) {
        throw new KnowledgeValidationError(
          "MISSING_RELATIONSHIP_ENDPOINT",
          `Relationship endpoint missing for relationship: ${relationship.id}`,
        );
      }

      if (
        !relationship.lineage ||
        !Array.isArray(relationship.lineage.parentKnowledgeRelationshipIds) ||
        !Array.isArray(relationship.lineage.parentEvidenceRelationshipIds) ||
        !Array.isArray(relationship.lineage.transformationSteps)
      ) {
        throw new KnowledgeValidationError("INVALID_LINEAGE", `Invalid relationship lineage: ${relationship.id}`);
      }
    }

    const claimIds = new Set<string>();

    for (const claim of graph.claims) {
      if (claimIds.has(claim.id)) {
        throw new KnowledgeValidationError("DUPLICATE_CLAIM_ID", `Duplicate claim id: ${claim.id}`);
      }

      claimIds.add(claim.id);

      if (!nodeIds.has(claim.subjectNodeId)) {
        throw new KnowledgeValidationError(
          "MISSING_CLAIM_SUBJECT",
          `Claim subject not found for claim: ${claim.id}`,
        );
      }

      if (claim.evidenceNodeIds.length === 0 || claim.evidenceRelationshipIds.length === 0) {
        throw new KnowledgeValidationError(
          "MISSING_EVIDENCE_REFERENCES",
          `Claim missing evidence references: ${claim.id}`,
        );
      }

      if (!isValidConfidence(claim.confidence)) {
        throw new KnowledgeValidationError("INVALID_CONFIDENCE", `Invalid claim confidence: ${claim.id}`);
      }

      if (
        !claim.lineage ||
        !Array.isArray(claim.lineage.parentClaimIds) ||
        !Array.isArray(claim.lineage.parentEvidenceNodeIds) ||
        !Array.isArray(claim.lineage.parentEvidenceRelationshipIds) ||
        !Array.isArray(claim.lineage.transformationSteps)
      ) {
        throw new KnowledgeValidationError("INVALID_LINEAGE", `Invalid claim lineage: ${claim.id}`);
      }
    }
  }

  validateIR(ir: KnowledgeIR): void {
    this.validateGraph(ir.graph);
    this.validateKnowledgeObjects(ir);

    if (!ir.compiledFromEvidenceHash) {
      throw new KnowledgeValidationError(
        "MISSING_COMPILED_FROM_EVIDENCE_HASH",
        "Knowledge IR is missing compiledFromEvidenceHash",
      );
    }

    if (ir.claimCount !== ir.graph.claims.length) {
      throw new KnowledgeValidationError(
        "CLAIM_COUNT_MISMATCH",
        `Claim count mismatch: expected ${ir.claimCount}, actual ${ir.graph.claims.length}`,
      );
    }

    const expectedHash = this.hasher.hashIR({
      schemaVersion: ir.schemaVersion,
      graph: ir.graph,
      claimCount: ir.claimCount,
      compiledFromEvidenceHash: ir.compiledFromEvidenceHash,
      generatedAt: ir.generatedAt,
    });

    if (expectedHash !== ir.deterministicHash) {
      throw new KnowledgeValidationError("HASH_MISMATCH", "Knowledge IR hash mismatch");
    }
  }
}
