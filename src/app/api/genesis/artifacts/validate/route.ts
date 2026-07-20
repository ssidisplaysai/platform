import { NextResponse } from "next/server";

import {
  ArtifactManager,
  resolveArtifactRoot,
} from "../../../../../../genesis/runtime/artifacts";

interface ValidateArtifactRequest {
  readonly id?: string;
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  try {
    const artifactManager = ArtifactManager.createLocal(
      resolveArtifactRoot(),
    );

    let body: ValidateArtifactRequest;

    try {
      body = (await request.json()) as ValidateArtifactRequest;
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must contain valid JSON.",
          },
        },
        { status: 400 },
      );
    }

    if (!body.id?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ARTIFACT_ID_REQUIRED",
            message: "Request body must include artifact id.",
          },
        },
        { status: 400 },
      );
    }

    const result = await artifactManager.validate(body.id);

    return NextResponse.json(
      {
        artifactId: body.id,
        valid: result.valid,
        errors: result.errors,
      },
      { status: result.valid ? 200 : 422 },
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
