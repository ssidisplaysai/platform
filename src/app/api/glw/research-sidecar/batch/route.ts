import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createGlwN8nResearchProvider,
} from "@/modules/glw/n8n-research-provider";
import {
  executeGlwBoundedResearchBatch,
} from "@/modules/glw/research-batch-executor";
import {
  GLW_RESEARCH_BATCH_CONFIRMATION,
  type GlwResearchBatchEnvelope,
} from "@/modules/glw/research-batch-authority";

function requireLoopback(request: NextRequest): void {
  const hostname = request.nextUrl.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname)) {
    throw new Error("GLW bounded research batch accepts loopback requests only.");
  }
}

function parseEnvelope(value: unknown): GlwResearchBatchEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("GLW bounded research batch request is malformed.");
  }
  const envelope = value as Record<string, unknown>;
  const keys = Object.keys(envelope).sort();
  if (
    keys.length !== 2
    || keys[0] !== "confirm"
    || keys[1] !== "requests"
    || envelope.confirm !== GLW_RESEARCH_BATCH_CONFIRMATION
    || !Array.isArray(envelope.requests)
  ) {
    throw new Error("Exact GLW bounded research batch confirmation and requests are required.");
  }
  return {
    confirm: GLW_RESEARCH_BATCH_CONFIRMATION,
    requests: envelope.requests as GlwResearchBatchEnvelope["requests"],
  };
}

export async function POST(request: NextRequest) {
  try {
    requireLoopback(request);
    const envelope = parseEnvelope(await request.json());
    const result = await executeGlwBoundedResearchBatch({
      envelope,
      provider: createGlwN8nResearchProvider(),
    });

    return NextResponse.json({
      ok: result.failed === 0,
      mode: "bounded_research_batch_v1",
      workflowId: "E3ZgpwAu98DwpUzO",
      ...result,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      mode: "bounded_research_batch_v1",
      error: error instanceof Error ? error.message : "GLW bounded research batch failed.",
      wordpressMutationPerformed: false,
      generationPerformed: false,
      certificationPerformed: false,
      publicationPerformed: false,
    }, { status: 400 });
  }
}
