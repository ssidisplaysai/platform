import { NextResponse } from "next/server";

import { resolveArtifactRoot } from "../../../../../../../genesis/runtime/artifacts";
import {
  ArtifactGraphService,
  resolveGraphRoot,
} from "../../../../../../../genesis/runtime/graph";

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

    const lineage = await graphService.getLineage(artifactId);

    if (!lineage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "LINEAGE_NOT_FOUND",
            message: `Lineage '${artifactId}' was not found.`,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(lineage, { status: 200 });
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
