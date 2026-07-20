export interface ArtifactLineage {
  readonly artifactId: string;
  readonly parents: readonly string[];
  readonly children: readonly string[];
  readonly dependencies: readonly string[];
  readonly compiler: string;
  readonly runtime: string;
  readonly createdAt: string;
  readonly generationDepth: number;
  readonly sourceEvidence: readonly string[];
}
