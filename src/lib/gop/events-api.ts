import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { createPrismaGlwJobRepository } from "@/lib/glw/job-repository";
import { getGenesisEventStore } from "@/platform/gop/runtime/event-store";
import { backfillGlwJobEvents } from "@/platform/gop/adapters/glw-events";
import { getPrismaClient } from "@/lib/glw/prisma";
import { metricsFromDerived, reduceEventsToMetrics } from "@/platform/gop/metrics-from-events";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { authorizeGenesisJobAction } from "@/platform/gop/actions/authorization";
import type { GenesisJobStatus, GenesisJobType } from "@/platform/gop/contracts";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";
import { getGenesisAuthenticationService } from "@/platform/identity/services";

const GLW_MODULE_ID = "glw.core";
const MAX_REPLAY_EVENTS = 300;

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
}

function forbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

async function authorizeJobRead(jobId: string) {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const store = getGenesisEventStore();
  const repository = createPrismaGlwJobRepository();

  let events = await store.listEventsForJob(jobId);
  if (events.length === 0) {
    const job = await repository.findById(jobId);
    if (job) {
      await backfillGlwJobEvents(store, job);
      events = await store.listEventsForJob(jobId);
    }
  }

  const latest = events.length > 0 ? events[events.length - 1] : null;
  const decision = authorizeGenesisJobAction({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: latest?.moduleId ?? GLW_MODULE_ID,
    jobType: (latest?.jobType ?? "PAGE_GENERATION") as GenesisJobType,
    jobStatus: (latest?.status ?? "QUEUED") as GenesisJobStatus,
    actionId: "job:view",
    ownerActorId: latest?.actorId ?? undefined,
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return {
    subject,
    events,
    store,
    repository,
  } as const;
}

export async function handleGetJobEvents(_request: Request, jobId: string): Promise<NextResponse> {
  const access = await authorizeJobRead(jobId);
  if ("error" in access) {
    return access.error;
  }

  const events = access.events;
  const timeline = await access.store.replayTimeline(jobId);
  const progress = await access.store.summarizeProgress(jobId);

  return NextResponse.json({ events, timeline, progress });
}

export async function handleGetGopMetrics(request: Request): Promise<NextResponse> {
  const session = await getGlwSession();
  if (!session) {
    return unauthorizedResponse();
  }

  const subject = buildGenesisSubjectFromSession(session);
  const metricsDecision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("metrics:view", "metrics_access"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
    },
  });

  if (!metricsDecision.allowed) {
    return forbiddenResponse(metricsDecision.reason);
  }

  const url = new URL(request.url);
  const limit = Math.min(5000, Math.max(100, Number(url.searchParams.get("limit") ?? "1000") || 1000));
  const prisma = getPrismaClient();

  const rows = await prisma.$queryRaw<Array<{
    eventType: string;
    status: string | null;
    jobId: string;
    durationMs: number | null;
  }>>`
    SELECT "eventType", "status", "jobId", "durationMs"
    FROM "GopJobEvent"
    ORDER BY "occurredAt" DESC
    LIMIT ${limit}
  `;

  const derived = reduceEventsToMetrics(rows);
  const metrics = metricsFromDerived(derived);
  const authenticationService = getGenesisAuthenticationService();
  const authentication = authenticationService.getMetrics();
  const authenticationProviders = authenticationService.getProviderHealth();
  const authenticationHealth = await authenticationService.healthSnapshot();

  return NextResponse.json({
    metrics,
    derived,
    sampleSize: rows.length,
    authentication,
    authenticationProviders,
    authenticationHealth,
  });
}

export async function handleStreamJobEvents(request: Request, jobId: string): Promise<Response> {
  const access = await authorizeJobRead(jobId);
  if ("error" in access) {
    return access.error;
  }

  const url = new URL(request.url);
  const afterSequence = Math.max(0, Number(url.searchParams.get("afterSequence") ?? "0") || 0);
  const encoder = new TextEncoder();

  let cursor = afterSequence;
  const initialReplay = access.events.filter((event) => event.sequence > afterSequence).slice(-MAX_REPLAY_EVENTS);
  if (initialReplay.length > 0) {
    cursor = initialReplay[initialReplay.length - 1].sequence;
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const write = (chunk: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(chunk));
        }
      };

      write(`event: ready\ndata: ${JSON.stringify({ jobId, cursor })}\n\n`);

      if (initialReplay.length > 0) {
        write(`event: events\ndata: ${JSON.stringify({ jobId, cursor, events: initialReplay })}\n\n`);
      }

      const heartbeat = setInterval(() => {
        write(`event: heartbeat\ndata: ${JSON.stringify({ ts: Date.now(), cursor })}\n\n`);
      }, 15000);

      const poll = setInterval(async () => {
        try {
          const updates = await access.store.listEventsAfterSequence(jobId, cursor);
          if (updates.length === 0) {
            return;
          }

          const bounded = updates.slice(0, MAX_REPLAY_EVENTS);
          cursor = bounded[bounded.length - 1].sequence;
          write(`event: events\ndata: ${JSON.stringify({ jobId, cursor, events: bounded })}\n\n`);
        } catch {
          write(`event: error\ndata: ${JSON.stringify({ message: "stream_poll_failed" })}\n\n`);
        }
      }, 1200);

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
