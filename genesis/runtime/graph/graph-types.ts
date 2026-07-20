export type ArtifactEdgeType =
  | "PARENT"
  | "CHILD"
  | "DEPENDS_ON"
  | "GENERATED_FROM"
  | "SUPERSEDES"
  | "REFERENCES";

export const SUPPORTED_ARTIFACT_EDGE_TYPES: readonly ArtifactEdgeType[] = [
  "PARENT",
  "CHILD",
  "DEPENDS_ON",
  "GENERATED_FROM",
  "SUPERSEDES",
  "REFERENCES",
];

export function isArtifactEdgeType(
  value: string,
): value is ArtifactEdgeType {
  return (SUPPORTED_ARTIFACT_EDGE_TYPES as readonly string[]).includes(
    value,
  );
}

export interface ArtifactGraphSummary {
  readonly nodes: number;
  readonly edges: number;
  readonly lineageTrees: number;
  readonly rootArtifacts: number;
  readonly leafArtifacts: number;
}
