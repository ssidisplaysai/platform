import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createGlwProducerWorkerApiService, type BeginAttemptInput, type CompleteAttemptInput, type EnqueueCompletionInput, type WorkerCycleInput } from "./producer-worker-api";

type Service = ReturnType<typeof createGlwProducerWorkerApiService>;
type Command = "WORKER_CYCLE" | "ENQUEUE_COMPLETION" | "BEGIN_ATTEMPT" | "COMPLETE_ATTEMPT";
type InvocationGate = { enter(workerId: string): boolean; leave(workerId: string): void };

const invocationWindows = new Map<string, { startedAt: number; count: number; inFlight: number }>();
const defaultInvocationGate: InvocationGate = {
  enter(workerId) {
    const now = Date.now();
    const current = invocationWindows.get(workerId);
    const window = !current || now - current.startedAt >= 60_000 ? { startedAt: now, count: 0, inFlight: 0 } : current;
    if (window.count >= 120 || window.inFlight >= 8) return false;
    window.count += 1; window.inFlight += 1; invocationWindows.set(workerId, window);
    return true;
  },
  leave(workerId) {
    const current = invocationWindows.get(workerId);
    if (current) current.inFlight = Math.max(0, current.inFlight - 1);
  },
};

function json(body: unknown, status = 200) { return NextResponse.json(body, { status }); }
function equal(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function text(value: unknown, max = 200): value is string { return typeof value === "string" && value.length > 0 && value.length <= max; }
function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "GLW_WORKER_COMMAND_FAILED";
  if (/COMMAND_CONFLICT/.test(message)) return json({ error: "COMMAND_CONFLICT" }, 409);
  if (/STALE|BUDGET|ALREADY_FINAL|INVALID_WORK_KIND/.test(message)) return json({ error: "STALE_OR_INVALID_STATE" }, 409);
  if (/INVALID_COMMAND_ID|INVALID_WORKER_ID|INVALID_INPUT/.test(message)) return json({ error: "INVALID_REQUEST" }, 400);
  return json({ error: "WORKER_COMMAND_UNAVAILABLE" }, 503);
}

function validBase(body: Record<string, unknown>) { return text(body.commandId) && text(body.workerId, 100); }
function hasOnly(body: Record<string, unknown>, allowed: string[]) { return Object.keys(body).every((key) => allowed.includes(key)); }
function validWork(body: Record<string, unknown>) {
  return validBase(body) && (body.workKind === "ORIGINAL" || body.workKind === "RECOVERY")
    && text(body.idempotencyKey, 500) && text(body.leaseToken, 100)
    && (body.recoveryAuthorizationId == null || text(body.recoveryAuthorizationId, 100));
}

const completionKeys = [
  "commandId", "workerId", "operationKey", "publicationKey", "jobId", "externalExecutionId",
  "terminalStatus", "idempotencyKey", "terminalScopeKey", "canonicalPayload", "payloadSha256",
  "wordpressPageId", "wordpressUrl", "qaContractVersion", "qaSummary",
];
function object(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function nullableText(value: unknown, max: number) { return value === null || text(value, max); }
function validCompletion(body: Record<string, unknown>): body is EnqueueCompletionInput {
  return hasOnly(body, completionKeys) && completionKeys.every((key) => Object.prototype.hasOwnProperty.call(body, key))
    && validBase(body)
    && text(body.operationKey, 500) && text(body.publicationKey, 500) && text(body.jobId, 200) && text(body.externalExecutionId, 200)
    && ["COMPLETE", "FAILED_QA", "FAILED"].includes(String(body.terminalStatus))
    && text(body.idempotencyKey, 500) && text(body.terminalScopeKey, 500)
    && object(body.canonicalPayload) && /^[0-9a-f]{64}$/.test(String(body.payloadSha256))
    && nullableText(body.wordpressPageId, 100) && nullableText(body.wordpressUrl, 2000)
    && (body.qaContractVersion === null || body.qaContractVersion === 16)
    && (body.qaSummary === null || object(body.qaSummary));
}

export async function handleGlwProducerWorkerCommand(request: Request, command: Command, dependencies: { service?: Service; token?: string; invocationGate?: InvocationGate } = {}) {
  const expected = dependencies.token ?? process.env.GLW_PRODUCER_WORKER_SYSTEM_TOKEN ?? "";
  const received = request.headers.get("x-glw-producer-worker-token") ?? "";
  if (!expected || !received || !equal(expected, received)) return json({ error: "Worker authentication required." }, 401);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "JSON content type required." }, 415);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || JSON.stringify(body).length > 16_384) return json({ error: "INVALID_REQUEST" }, 400);
  const service = dependencies.service ?? createGlwProducerWorkerApiService();
  const workerId = typeof body.workerId === "string" ? body.workerId : "invalid";
  const gate = dependencies.invocationGate ?? defaultInvocationGate;
  if (!gate.enter(workerId)) return json({ error: "WORKER_RATE_LIMITED" }, 429);
  try {
    if (command === "WORKER_CYCLE") {
      if (!hasOnly(body, ["commandId", "workerId", "instanceId"]) || !validBase(body) || !text(body.instanceId, 100)) return json({ error: "INVALID_REQUEST" }, 400);
      return json(await service.workerCycle(body as WorkerCycleInput));
    }
    if (command === "ENQUEUE_COMPLETION") {
      if (!validCompletion(body)) return json({ error: "INVALID_REQUEST" }, 400);
      return json(await service.enqueueCompletion(body));
    }
    const workKeys = ["commandId", "workerId", "workKind", "idempotencyKey", "recoveryAuthorizationId", "leaseToken"];
    if (!validWork(body)) return json({ error: "INVALID_REQUEST" }, 400);
    if (command === "BEGIN_ATTEMPT" && !hasOnly(body, workKeys)) return json({ error: "INVALID_REQUEST" }, 400);
    if (command === "BEGIN_ATTEMPT") return json(await service.beginAttempt(body as BeginAttemptInput));
    if (!hasOnly(body, [...workKeys, "attemptNumber", "resultClass", "httpStatus", "errorClass", "receiverOutcome", "receiverReceiptId", "durationMs", "jitterFraction"])) return json({ error: "INVALID_REQUEST" }, 400);
    if (!Number.isInteger(body.attemptNumber) || Number(body.attemptNumber) < 1 || Number(body.attemptNumber) > 12
      || !["ACKNOWLEDGED", "RETRYABLE", "DEAD_LETTER"].includes(String(body.resultClass))
      || typeof body.jitterFraction !== "number" || body.jitterFraction < 0 || body.jitterFraction > 0.2) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }
    return json(await service.completeAttempt(body as CompleteAttemptInput));
  } catch (error) { return safeError(error); }
  finally { gate.leave(workerId); }
}