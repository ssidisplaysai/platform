import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  compileWorkbook,
  readBearerToken,
  resolveWorkbookRuntimeConfig,
  validateWorkbookCompileApiRequest,
} from "../../../../../../genesis/runtime/workbook";

function secretsMatch(
  received: string,
  expected: string,
): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(
  request: Request,
): Promise<NextResponse> {
  let configuration;

  try {
    configuration = resolveWorkbookRuntimeConfig();
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RUNTIME_NOT_CONFIGURED",
          message:
            error instanceof Error
              ? error.message
              : "Genesis runtime is not configured.",
        },
      },
      { status: 503 },
    );
  }

  const bearerToken = readBearerToken(
    request.headers.get("authorization"),
  );

  if (
    !bearerToken ||
    !secretsMatch(bearerToken, configuration.apiKey)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "A valid bearer token is required.",
        },
      },
      { status: 401 },
    );
  }

  try {
    const rawBody = await request.text();
    const requestBytes = Buffer.byteLength(rawBody, "utf8");

    if (requestBytes > configuration.maximumRequestBytes) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "REQUEST_TOO_LARGE",
            message: `Request body exceeds ${configuration.maximumRequestBytes} bytes.`,
          },
        },
        { status: 413 },
      );
    }

    let parsedBody: unknown;

    try {
      parsedBody = JSON.parse(rawBody);
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

    const body =
      validateWorkbookCompileApiRequest(parsedBody);

    const result = await compileWorkbook({
      workbook: body.workbook!,
      artifactRoot: configuration.artifactRoot,
      runId: body.runId,
    });

    return NextResponse.json(
      {
        success: true,
        runId: result.runId,
        manifest: result.manifest,
        inventory: result.inventory,
        artifact: {
          type: "WorkbookInventory",
          sha256: result.artifact.sha256,
        },
      },
      { status: 200 },
    );
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
      { status: 400 },
    );
  }
}

