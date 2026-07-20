import { NextResponse } from "next/server";

import { resolveArtifactRoot } from "../../../../../genesis/runtime/artifacts";
import {
  ArtifactGraphService,
  resolveGraphRoot,
} from "../../../../../genesis/runtime/graph";

export async function GET(): Promise<NextResponse> {
  try {
    const artifactRoot = resolveArtifactRoot();
    const graphService = ArtifactGraphService.createLocal(
      resolveGraphRoot(artifactRoot),
    );

    const summary = await graphService.getSummary();

    return NextResponse.json(summary, { status: 200 });
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
