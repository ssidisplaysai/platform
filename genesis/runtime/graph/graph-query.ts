import type { ArtifactEdge } from "./artifact-edge";
import type { ArtifactNode } from "./artifact-node";

export function queryOutgoing(
  edges: readonly ArtifactEdge[],
  artifactId: string,
): readonly ArtifactEdge[] {
  return edges.filter(
    (edge) => edge.fromArtifactId === artifactId,
  );
}

export function queryIncoming(
  edges: readonly ArtifactEdge[],
  artifactId: string,
): readonly ArtifactEdge[] {
  return edges.filter((edge) => edge.toArtifactId === artifactId);
}

export function queryNode(
  nodes: readonly ArtifactNode[],
  artifactId: string,
): ArtifactNode | null {
  return (
    nodes.find((node) => node.artifactId === artifactId) ?? null
  );
}
