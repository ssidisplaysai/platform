import { NextResponse } from "next/server";

import {
  ArtifactManager,
  resolveArtifactRoot,
} from "../../../../../genesis/runtime/artifacts";

export async function GET(): Promise<NextResponse> {
  try {
    const artifactManager = ArtifactManager.createLocal(
      resolveArtifactRoot(),
    );

    const artifacts = await artifactManager.list();

    return NextResponse.json(
      {
        runtime: "Genesis Runtime",
        artifactCount: artifacts.length,
        artifacts,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ARTIFACT_STORE_NOT_CONFIGURED",
          message:
            error instanceof Error
              ? error.message
              : "Artifact store is not configured.",
        },
      },
      { status: 503 },
    );
  }
}
