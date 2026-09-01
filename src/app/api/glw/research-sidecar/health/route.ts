import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  GLW_RESEARCH_SIDECAR_WORKFLOW_ID,
} from "@/modules/glw/research-sidecar-authority";

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
    || request.headers.has("forwarded")
    || request.headers.has("x-forwarded-for")
    || request.headers.has("x-forwarded-host")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "GLW research sidecar accepts loopback requests only.",
      },
      {
        status: 403,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    service:
      "glw-research-sidecar-v1",
    scope:
      "colorado-research-canary-only",
    workflowId:
      GLW_RESEARCH_SIDECAR_WORKFLOW_ID,
    sourceSha:
      process.env.GLW_RESEARCH_SIDECAR_SOURCE_SHA
      ?? null,
    wordpressMutationAuthority:
      false,
    generationAuthority:
      false,
    certificationAuthority:
      false,
    publicationAuthority:
      false,
  });
}
