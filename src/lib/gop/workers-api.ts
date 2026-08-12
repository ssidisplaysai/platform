import { NextResponse } from "next/server";
import { getGlwSession } from "@/lib/glw/auth";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { getGenesisOrchestrationRuntime } from "@/platform/gop/runtime/orchestration-runtime";
import { verifyWorkerToken } from "@/platform/gop/runtime/worker-token";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const GLW_MODULE_ID = "glw.core";

type WorkersAuthorizeResult =
  | { error: NextResponse }
  | { subject: ReturnType<typeof buildGenesisSubjectFromSession> };

type WorkerProtocolVerificationResult =
  | { error: NextResponse }
  | { token: NonNullable<ReturnType<typeof verifyWorkerToken>> };

function unauthorizedResponse(): NextResponse {
  return NextResponse.json({ error: "GLW session is required." }, { status: 401 });
}

function forbiddenResponse(reason: string): NextResponse {
  return NextResponse.json({ error: reason }, { status: 403 });
}

function parseWorkerBearer(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return null;
  }

  return auth.slice("Bearer ".length).trim();
}

function unauthorizedWorkerResponse(): NextResponse {
  return NextResponse.json({ error: "Signed worker token is required." }, { status: 401 });
}

function verifyProtocolWorker(request: Request, expectedWorkerId?: string): WorkerProtocolVerificationResult {
  const token = parseWorkerBearer(request);
  const secret = process.env.GOP_WORKER_TOKEN_SECRET;
  if (!token || !secret) {
    return { error: unauthorizedWorkerResponse() } as const;
  }

  const payload = verifyWorkerToken(token, secret);
  if (!payload) {
    return { error: unauthorizedWorkerResponse() } as const;
  }

  if (expectedWorkerId && payload.workerId !== expectedWorkerId) {
    return { error: NextResponse.json({ error: "workerId does not match signed token." }, { status: 403 }) } as const;
  }

  return { token: payload } as const;
}

async function authorizeWorkerControl(): Promise<WorkersAuthorizeResult> {
  const session = await getGlwSession();
  if (!session) {
    return { error: unauthorizedResponse() } as const;
  }

  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
    action: createActionReference("worker:register", "admin_control"),
    resource: {
      workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
      moduleId: GLW_MODULE_ID,
    },
  });

  if (!decision.allowed) {
    return { error: forbiddenResponse(decision.reason) } as const;
  }

  return { subject } as const;
}

export async function handleRegisterWorker(request: Request): Promise<NextResponse> {
  const access = await authorizeWorkerControl();
  if ("error" in access) {
    return access.error;
  }

  const body = await request.json().catch(() => null) as {
    workerId?: string;
    name?: string;
    workerType?: string;
    capabilities?: string[];
    maxCapacity?: number;
  } | null;

  if (!body?.workerId || !body?.name || !body?.workerType) {
    return NextResponse.json({ error: "workerId, name, and workerType are required." }, { status: 400 });
  }

  const runtime = getGenesisOrchestrationRuntime();
  const worker = runtime.workers.register({
    workerId: body.workerId,
    name: body.name,
    workerType: body.workerType,
    capabilities: body.capabilities ?? [],
    maxCapacity: Math.max(1, body.maxCapacity ?? 1),
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: GLW_MODULE_ID,
  });

  return NextResponse.json({ worker }, { status: 201 });
}

export async function handleWorkerHeartbeat(workerId: string): Promise<NextResponse> {
  const access = await authorizeWorkerControl();
  if ("error" in access) {
    return access.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  const worker = runtime.workers.heartbeat(workerId);

  if (!worker) {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }

  return NextResponse.json({ worker });
}

export async function handleProtocolWorkerRegister(request: Request): Promise<NextResponse> {
  const verified = verifyProtocolWorker(request);
  if ("error" in verified) {
    return verified.error;
  }

  const body = await request.json().catch(() => null) as {
    workerId?: string;
    name?: string;
    workerType?: string;
    capabilities?: string[];
    maxCapacity?: number;
    protocolVersion?: string;
    supportedProtocolVersions?: string[];
    instanceId?: string;
    environment?: string;
    leaseTtlMs?: number;
    heartbeatIntervalMs?: number;
    workspaceId?: string;
    moduleId?: string;
  } | null;

  if (!body?.workerId || !body?.name || !body?.workerType) {
    return NextResponse.json({ error: "workerId, name, and workerType are required." }, { status: 400 });
  }

  if (verified.token.workerId !== body.workerId) {
    return NextResponse.json({ error: "workerId in token does not match request body." }, { status: 403 });
  }

  const runtime = getGenesisOrchestrationRuntime();
  const worker = runtime.workers.register({
    workerId: body.workerId,
    name: body.name,
    workerType: body.workerType,
    capabilities: body.capabilities ?? [],
    maxCapacity: Math.max(1, body.maxCapacity ?? 1),
    protocolVersion: body.protocolVersion ?? verified.token.protocolVersion,
    supportedProtocolVersions: body.supportedProtocolVersions ?? [body.protocolVersion ?? verified.token.protocolVersion],
    instanceId: body.instanceId,
    environment: body.environment,
    leaseTtlMs: body.leaseTtlMs,
    heartbeatIntervalMs: body.heartbeatIntervalMs,
    tokenId: verified.token.tokenId,
    authMode: "SIGNED_TOKEN",
    workspaceId: body.workspaceId ?? GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: body.moduleId ?? GLW_MODULE_ID,
  });

  return NextResponse.json({ worker }, { status: 201 });
}

export async function handleProtocolWorkerHeartbeat(request: Request, workerId: string): Promise<NextResponse> {
  const verified = verifyProtocolWorker(request, workerId);
  if ("error" in verified) {
    return verified.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  const worker = runtime.workers.authenticate({
    workerId,
    tokenId: verified.token.tokenId,
    protocolVersion: verified.token.protocolVersion,
  });

  if (!worker) {
    return NextResponse.json({ error: "Worker authentication failed." }, { status: 403 });
  }

  const heartbeat = runtime.workers.heartbeat(workerId);
  if (!heartbeat) {
    return NextResponse.json({ error: "Worker not found." }, { status: 404 });
  }

  return NextResponse.json({ worker: heartbeat });
}

export async function handleAcquireWorkerLease(request: Request, workerId: string): Promise<NextResponse> {
  const verified = verifyProtocolWorker(request, workerId);
  if ("error" in verified) {
    return verified.error;
  }

  const runtime = getGenesisOrchestrationRuntime();
  const worker = runtime.workers.getById(workerId);
  if (!worker) {
    return NextResponse.json({ error: "Worker not registered." }, { status: 404 });
  }

  const leased = runtime.acquireWorkLease({
    workerId,
    workerType: worker.workerType,
    workerCapabilities: worker.capabilities,
    protocolVersion: verified.token.protocolVersion,
    tokenId: verified.token.tokenId,
  });

  if (!leased) {
    return NextResponse.json({ lease: null, execution: null }, { status: 200 });
  }

  return NextResponse.json({ lease: leased.lease, execution: leased.execution });
}

export async function handleRenewWorkerLease(request: Request, workerId: string): Promise<NextResponse> {
  const verified = verifyProtocolWorker(request, workerId);
  if ("error" in verified) {
    return verified.error;
  }

  const body = await request.json().catch(() => null) as { leaseId?: string } | null;
  if (!body?.leaseId) {
    return NextResponse.json({ error: "leaseId is required." }, { status: 400 });
  }

  const runtime = getGenesisOrchestrationRuntime();
  const renewed = runtime.renewExecutionLease({
    leaseId: body.leaseId,
    workerId,
  });

  if (!renewed) {
    return NextResponse.json({ error: "Lease not found or cannot be renewed." }, { status: 404 });
  }

  return NextResponse.json({ lease: renewed, protocolVersion: verified.token.protocolVersion });
}

export async function handleReleaseWorkerLease(request: Request, workerId: string): Promise<NextResponse> {
  const verified = verifyProtocolWorker(request, workerId);
  if ("error" in verified) {
    return verified.error;
  }

  const body = await request.json().catch(() => null) as {
    leaseId?: string;
    outcome?: "COMPLETED" | "FAILED" | "RETRY" | "ABANDONED";
    reason?: string;
  } | null;

  if (!body?.leaseId || !body?.outcome) {
    return NextResponse.json({ error: "leaseId and outcome are required." }, { status: 400 });
  }

  const runtime = getGenesisOrchestrationRuntime();
  const execution = runtime.releaseExecutionLease({
    leaseId: body.leaseId,
    workerId,
    outcome: body.outcome,
    reason: body.reason,
  });

  if (!execution) {
    return NextResponse.json({ error: "Lease not found or execution unavailable." }, { status: 404 });
  }

  return NextResponse.json({ execution, protocolVersion: verified.token.protocolVersion });
}
