import { NextResponse } from "next/server";

import { compileWorkbook } from "../../../../../../genesis/runtime/workbook";
import type { GoogleWorkbookMetadata } from "../../../../../../genesis/adapters/google-sheets";

interface CompileWorkbookApiRequest {
  readonly workbook?: GoogleWorkbookMetadata;
  readonly artifactRoot?: string;
  readonly runId?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CompileWorkbookApiRequest;

    if (!body.workbook) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must include workbook metadata.",
          },
        },
        { status: 400 },
      );
    }

    if (!body.artifactRoot?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Request body must include artifactRoot.",
          },
        },
        { status: 400 },
      );
    }

    const result = await compileWorkbook({
      workbook: body.workbook,
      artifactRoot: body.artifactRoot,
      runId: body.runId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown workbook compilation error.";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "WORKBOOK_COMPILATION_FAILED",
          message,
        },
      },
      { status: 500 },
    );
  }
}
