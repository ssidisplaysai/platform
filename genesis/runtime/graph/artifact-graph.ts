import type { ArtifactEdge } from "./artifact-edge";
import type { ArtifactLineage } from "./artifact-lineage";
import type { ArtifactNode } from "./artifact-node";
import type { ArtifactGraphSummary } from "./graph-types";

export interface ArtifactGraph {
  readonly summary: ArtifactGraphSummary;
  readonly nodes: readonly ArtifactNode[];
  readonly edges: readonly ArtifactEdge[];
  readonly lineages: readonly ArtifactLineage[];
}
