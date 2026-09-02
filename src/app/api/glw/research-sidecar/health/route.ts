import {
  NextRequest,
  NextResponse,
} from "next/server";

const GLW_RESEARCH_WORKFLOW_ID =
  "E3ZgpwAu98DwpUzO";

export async function GET(
  request: NextRequest,
) {
  const hostname =
    request.nextUrl.hostname.toLowerCase();

  if (
    ![
      "127.0.0.1",
      "localhost",
      "[::1]",
      "::1",
    ].includes(hostname)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GLW bounded research sidecar accepts loopback requests only.",
      },
      {
        status: 403,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    service: "glw-bounded-research-batch-v1",
    scope: "ak-al-ar-az-ct-de-fl-ga-hi-only",
    networkBoundary: "127.0.0.1-bind-required",
    workflowId: GLW_RESEARCH_WORKFLOW_ID,
    sourceSha:
      process.env.GLW_RESEARCH_SIDECAR_SOURCE_SHA
      ?? null,
    coloradoAuthority: false,
    wordpressMutationAuthority: false,
    generationAuthority: false,
    certificationAuthority: false,
    publicationAuthority: false,
  });
}
