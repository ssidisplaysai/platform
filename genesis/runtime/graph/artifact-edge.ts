import { createHash } from "node:crypto";

import type { ArtifactEdgeType } from "./graph-types";

export interface ArtifactEdge {
  readonly id: string;
  readonly fromArtifactId: string;
  readonly toArtifactId: string;
  readonly type: ArtifactEdgeType;
  readonly createdAt: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface CreateArtifactEdgeRequest {
  readonly fromArtifactId: string;
  readonly toArtifactId: string;
  readonly type: ArtifactEdgeType;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function createArtifactEdgeId(
  request: CreateArtifactEdgeRequest,
): string {
  return createHash("sha256")
    .update(
      `${request.type}:${request.fromArtifactId}->${request.toArtifactId}`,
      "utf8",
    )
    .digest("hex");
}
