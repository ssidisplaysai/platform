import type { KnowledgeGraph } from "./KnowledgeGraph";
import { KnowledgeGraphHasher } from "./KnowledgeGraphHasher";
import type { KnowledgeIR } from "./KnowledgeIR";

export type KnowledgeValidationErrorCode =
  | "DUPLICATE_NODE_ID"
  | "DUPLICATE_RELATIONSHIP_ID"
  | "DUPLICATE_CLAIM_ID"
  | "MISSING_RELATIONSHIP_ENDPOINT"
  | "MISSING_CLAIM_SUBJECT"
  | "MISSING_EVIDENCE_REFERENCES"
  | "INVALID_CONFIDENCE"
  | "INVALID_LINEAGE"
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
