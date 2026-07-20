import type { ArtifactEdge } from "./artifact-edge";
import type { ArtifactLineage } from "./artifact-lineage";
import type { ArtifactNode } from "./artifact-node";
import { isArtifactEdgeType } from "./graph-types";

export interface GraphValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

function hasPath(
  edges: readonly ArtifactEdge[],
  start: string,
  target: string,
  visited = new Set<string>(),
): boolean {
  if (start === target) {
    return true;
  }

  if (visited.has(start)) {
    return false;
  }

  visited.add(start);

  const outgoing = edges.filter(
    (edge) => edge.fromArtifactId === start,
  );

  return outgoing.some((edge) =>
    hasPath(edges, edge.toArtifactId, target, visited),
  );
}

export class GraphValidator {
  public validateNode(
    node: ArtifactNode,
    existingNodes: readonly ArtifactNode[],
  ): GraphValidationResult {
    const errors: string[] = [];

    if (!node.artifactId.trim()) {
      errors.push("Node artifactId is required.");
    }

    const duplicate = existingNodes.find(
      (existing) => existing.artifactId === node.artifactId,
    );

    if (duplicate) {
      errors.push(`Duplicate node '${node.artifactId}'.`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public validateEdge(
    edge: ArtifactEdge,
    existingEdges: readonly ArtifactEdge[],
    existingNodes: readonly ArtifactNode[],
  ): GraphValidationResult {
    const errors: string[] = [];

    if (!isArtifactEdgeType(edge.type)) {
      errors.push(`Invalid edge type '${edge.type}'.`);
    }

    if (edge.fromArtifactId === edge.toArtifactId) {
      errors.push("Self-referencing edge is not allowed.");
    }

    const duplicate = existingEdges.find(
      (existing) =>
        existing.type === edge.type &&
        existing.fromArtifactId === edge.fromArtifactId &&
        existing.toArtifactId === edge.toArtifactId,
    );

    if (duplicate) {
      errors.push("Duplicate edge is not allowed.");
    }

    const requiresArtifactNode =
      edge.type === "PARENT" ||
      edge.type === "CHILD" ||
      edge.type === "DEPENDS_ON" ||
      edge.type === "SUPERSEDES";

    if (requiresArtifactNode) {
      const fromExists = existingNodes.some(
        (node) => node.artifactId === edge.fromArtifactId,
      );
      const toExists = existingNodes.some(
        (node) => node.artifactId === edge.toArtifactId,
      );

      if (!fromExists || !toExists) {
        errors.push(
          "Edge references missing artifact nodes.",
        );
      }
    }

    if (
      (edge.type === "PARENT" || edge.type === "DEPENDS_ON") &&
      hasPath(existingEdges, edge.toArtifactId, edge.fromArtifactId)
    ) {
      errors.push("Circular edge detected.");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  public validateLineage(
    lineage: ArtifactLineage,
    node: ArtifactNode | null,
  ): GraphValidationResult {
    const errors: string[] = [];

    if (!node) {
      errors.push(
        `Lineage node '${lineage.artifactId}' is missing.`,
      );
    }

    if (lineage.generationDepth < 0) {
      errors.push("Lineage generationDepth must be non-negative.");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
