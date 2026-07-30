import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
}

function forbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

async function authorizeOperationsRead() {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("metrics:view", "metrics_access"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
      route: "/glw/operations",
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return { subject } as const;
}

export async function handleGetOperationsSnapshot(): Promise<NextResponse> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  const snapshot = await runtime.buildOperationsSnapshot(GENESIS_PRIMARY_WORKSPACE_ID, getGenesisEventStore());
  return NextResponse.json({ snapshot });
}

export async function handleOperationsStream(request: Request): Promise<Response> {
  const access = await authorizeOperationsRead();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };

      const initial = await runtime.buildOperationsSnapshot(GENESIS_PRIMARY_WORKSPACE_ID, getGenesisEventStore());
      write(`event: snapshot\ndata: ${JSON.stringify({ snapshot: initial })}\n\n`);

      const heartbeat = setInterval(() => {
        write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);
      }, 15000);

      const poll = setInterval(async () => {
        try {
          const next = await runtime.buildOperationsSnapshot(GENESIS_PRIMARY_WORKSPACE_ID, getGenesisEventStore());
          write(`event: snapshot\ndata: ${JSON.stringify({ snapshot: next })}\n\n`);
        } catch {
          write(`event: error\ndata: ${JSON.stringify({ message: "operations_stream_poll_failed" })}\n\n`);
        }
      }, 2000);

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        clearInterval(heartbeat);
        clearInterval(poll);
        controller.close();
      };

      request.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
