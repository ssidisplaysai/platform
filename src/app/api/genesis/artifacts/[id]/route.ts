import { NextResponse } from "next/server";

import {
  ArtifactManager,
  resolveArtifactRoot,
} from "../../../../../../genesis/runtime/artifacts";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const artifactManager = ArtifactManager.createLocal(
      resolveArtifactRoot(),
    );
    const artifact = await artifactManager.load(id);

    if (!artifact) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ARTIFACT_NOT_FOUND",
            message: `Artifact '${id}' was not found.`,
          },
        },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        id: artifact.id,
        displayId: artifact.displayId,
        type: artifact.type,
        version: artifact.version,
        compilerId: artifact.compilerId,
        compilerVersion: artifact.compilerVersion,
        runtimeVersion: artifact.runtimeVersion,
        status: artifact.status,
        createdAt: artifact.createdAt,
        sha256: artifact.sha256,
        manifest: artifact.manifest,
        metadata: artifact.metadata,
        dependencies: artifact.dependencies,
        parentArtifacts: artifact.parentArtifacts,
        lineage: artifact.lineage,
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
