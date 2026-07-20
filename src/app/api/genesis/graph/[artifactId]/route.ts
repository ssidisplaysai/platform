import { NextResponse } from "next/server";

import { resolveArtifactRoot } from "../../../../../../genesis/runtime/artifacts";
import {
  ArtifactGraphService,
  resolveGraphRoot,
} from "../../../../../../genesis/runtime/graph";

export async function GET(
  _request: Request,
  context: { params: Promise<{ artifactId: string }> },
): Promise<NextResponse> {
  try {
    const { artifactId } = await context.params;
    const artifactRoot = resolveArtifactRoot();
    const graphService = ArtifactGraphService.createLocal(
      resolveGraphRoot(artifactRoot),
    );

    const node = await graphService.getNode(artifactId);

    if (!node) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "GRAPH_NODE_NOT_FOUND",
            message: `Graph node '${artifactId}' was not found.`,
          },
        },
        { status: 404 },
      );
    }

    const parents = await graphService.getParents(artifactId);
    const children = await graphService.getChildren(artifactId);
    const dependencies = await graphService.getDependencies(artifactId);
    const dependents = await graphService.getDependents(artifactId);
    const lineage = await graphService.getLineage(artifactId);

    return NextResponse.json(
      {
        node,
        parents,
        children,
        dependencies,
        dependents,
        lineage,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GRAPH_NOT_CONFIGURED",
          message:
            error instanceof Error
              ? error.message
              : "Graph repository is not configured.",
        },
      },
      { status: 503 },
    );
  }
}
