import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createGlwN8nResearchProvider,
} from "@/modules/glw/n8n-research-provider";
import {
  validateGlwResearchSidecarInput,
} from "@/modules/glw/research-sidecar-authority";
import {
  executeGlwSiteEnrichmentResearch,
} from "@/modules/glw/site-enrichment-research-executor";

function requireLoopback(
  request: NextRequest,
): void {
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
    throw new Error(
      "GLW research sidecar accepts loopback requests only.",
    );
  }
}

export async function POST(
  request: NextRequest,
) {
  try {
    requireLoopback(request);

    const input =
      validateGlwResearchSidecarInput(
        await request.json(),
      );

    const result =
      await executeGlwSiteEnrichmentResearch({
        request: input,
        provider:
          createGlwN8nResearchProvider(),
      });

    return NextResponse.json({
      ok: true,
      mode: "colorado_research_canary",
      workflowId:
        "E3ZgpwAu98DwpUzO",
      record: result.record,
      providerInvoked:
        result.providerInvoked,
      researchReady:
        result.researchReady,
      wordpressMutationPerformed:
        result.wordpressMutationPerformed,
      generationPerformed:
        result.generationPerformed,
      certificationPerformed:
        result.certificationPerformed,
      publicationPerformed:
        result.publicationPerformed,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Colorado research canary failed.",
        wordpressMutationPerformed:
          false,
        generationPerformed:
          false,
        certificationPerformed:
          false,
        publicationPerformed:
          false,
      },
      {
        status: 400,
      },
    );
  }
}
