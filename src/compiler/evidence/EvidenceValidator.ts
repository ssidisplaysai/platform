import type { EvidenceIR } from "./EvidenceIR";
import type { EvidenceGraph } from "./EvidenceGraph";
import { EvidenceGraphHasher } from "./EvidenceGraphHasher";

export type EvidenceValidationErrorCode =
  | "DUPLICATE_NODE_ID"
  | "DUPLICATE_RELATIONSHIP_ID"
  | "MISSING_RELATIONSHIP_ENDPOINT"
  | "INVALID_NODE_CONFIDENCE"
  | "INVALID_ARTIFACT_NODE"
  | "INVALID_LINEAGE"
  | "ARTIFACT_COUNT_MISMATCH"
  | "HASH_MISMATCH";

export class EvidenceValidationError extends Error {
  readonly code: EvidenceValidationErrorCode;

  constructor(code: EvidenceValidationErrorCode, message: string) {
    super(message);
    this.name = "EvidenceValidationError";
    this.code = code;
  }
}

export class EvidenceValidator {
  private readonly hasher = new EvidenceGraphHasher();

  validateGraph(graph: EvidenceGraph): void {
    const nodeIds = new Set<string>();

    for (const node of graph.nodes) {
      if (nodeIds.has(node.id)) {
        throw new EvidenceValidationError("DUPLICATE_NODE_ID", `Duplicate node id: ${node.id}`);
      }

      nodeIds.add(node.id);

      if (node.confidence < 0 || node.confidence > 1 || Number.isNaN(node.confidence)) {
        throw new EvidenceValidationError("INVALID_NODE_CONFIDENCE", `Invalid node confidence: ${node.id}`);
      }

      if (node.nodeType === "artifact" && (!node.artifactId || !node.versionId || !node.checksum)) {
        throw new EvidenceValidationError("INVALID_ARTIFACT_NODE", `Artifact node missing required fields: ${node.id}`);
      }

      if (!node.lineage || !Array.isArray(node.lineage.parentNodeIds) || !Array.isArray(node.lineage.transformationSteps)) {
        throw new EvidenceValidationError("INVALID_LINEAGE", `Invalid node lineage: ${node.id}`);
      }
    }

    const relationshipIds = new Set<string>();

    for (const relationship of graph.relationships) {
      if (relationshipIds.has(relationship.id)) {
        throw new EvidenceValidationError(
          "DUPLICATE_RELATIONSHIP_ID",
          `Duplicate relationship id: ${relationship.id}`,
        );
      }

      relationshipIds.add(relationship.id);

      if (!nodeIds.has(relationship.from) || !nodeIds.has(relationship.to)) {
        throw new EvidenceValidationError(
          "MISSING_RELATIONSHIP_ENDPOINT",
          `Relationship endpoint missing for relationship: ${relationship.id}`,
        );
      }

      if (
        !relationship.lineage ||
        !Array.isArray(relationship.lineage.parentRelationshipIds) ||
        !Array.isArray(relationship.lineage.transformationSteps)
      ) {
        throw new EvidenceValidationError("INVALID_LINEAGE", `Invalid relationship lineage: ${relationship.id}`);
      }
    }
  }

  validateIR(ir: EvidenceIR): void {
    this.validateGraph(ir.graph);

    const artifactCount = ir.graph.nodes.filter((node) => node.nodeType === "artifact").length;
    if (artifactCount !== ir.artifactCount) {
      throw new EvidenceValidationError(
        "ARTIFACT_COUNT_MISMATCH",
        `Artifact count mismatch: expected ${ir.artifactCount}, actual ${artifactCount}`,
      );
    }

    const expectedHash = this.hasher.hashIR({
      schemaVersion: ir.schemaVersion,
      graph: ir.graph,
      artifactCount: ir.artifactCount,
      generatedAt: ir.generatedAt,
    });

    if (expectedHash !== ir.deterministicHash) {
      throw new EvidenceValidationError("HASH_MISMATCH", "Evidence IR hash mismatch");
    }
  }
}
