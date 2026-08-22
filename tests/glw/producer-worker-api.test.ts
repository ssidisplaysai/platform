import { describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });

import { handleGlwProducerWorkerCommand } from "@/lib/glw/producer-worker-api-handler";

function service() {
  return {
    workerCycle: jest.fn(async () => ({ replayed: false, items: [] })),
    beginAttempt: jest.fn(async () => ({ replayed: false, attemptNumber: 1 })),
    completeAttempt: jest.fn(async () => ({ replayed: false, deliveryStatus: "ACKNOWLEDGED" })),
    enqueueCompletion: jest.fn(async () => ({ replayed: false, outcome: "ENQUEUED" })),
  };
}
function request(body: unknown, token = "test-worker-token") {
  return new Request("https://example.test/api/glw/callback-delivery-worker", {
    method: "POST", headers: { "content-type": "application/json", "x-glw-producer-worker-token": token }, body: JSON.stringify(body),
  });
}

describe("HR-004 HTTPS producer worker API", () => {
  it("rejects missing authentication", async () => {
    const response = await handleGlwProducerWorkerCommand(request({}, ""), "WORKER_CYCLE", { service: service(), token: "expected" });
    expect(response.status).toBe(401);
  });
  it("rejects wrong authentication", async () => {
    const response = await handleGlwProducerWorkerCommand(request({}, "wrong"), "WORKER_CYCLE", { service: service(), token: "expected" });
    expect(response.status).toBe(401);
  });
  it("executes an authenticated worker cycle", async () => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123" }), "WORKER_CYCLE", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(200);
    expect(mock.workerCycle).toHaveBeenCalledTimes(1);
  });
  it("authenticates and enqueues an exact producer completion envelope", async () => {
    const mock = service();
    const body = {
      commandId: "enqueue:completion:0001", workerId: "worker-enqueue",
      operationKey: "glw-op-v1:test", publicationKey: "glw-publication-v1:test", jobId: "job-test", externalExecutionId: "exec-test",
      terminalStatus: "FAILED_QA", idempotencyKey: "glw-callback-v2:test", terminalScopeKey: "glw-terminal-v2:test",
      canonicalPayload: { jobId: "job-test", executionId: "exec-test", status: "FAILED_QA" }, payloadSha256: "a".repeat(64),
      wordpressPageId: "19603", wordpressUrl: "https://example.test/page/", qaContractVersion: 16, qaSummary: { disposition: "FAILED_QA" },
    };
    const response = await handleGlwProducerWorkerCommand(request(body), "ENQUEUE_COMPLETION", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "ENQUEUED" });
    expect(mock.enqueueCompletion).toHaveBeenCalledWith(body);
  });
  it.each([["", "missing"], ["wrong", "invalid"]])("rejects %s completion enqueue authentication", async (token) => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({}, token), "ENQUEUE_COMPLETION", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(401);
    expect(mock.enqueueCompletion).not.toHaveBeenCalled();
  });
  it("rejects unknown or missing producer completion fields", async () => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "enqueue:invalid:0001", workerId: "worker-enqueue", sql: "SELECT 1" }), "ENQUEUE_COMPLETION", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(400);
    expect(mock.enqueueCompletion).not.toHaveBeenCalled();
  });
  it("rejects an oversized producer completion body", async () => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "enqueue:oversized:0001", workerId: "worker-enqueue", padding: "x".repeat(17_000) }), "ENQUEUE_COMPLETION", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(400);
    expect(mock.enqueueCompletion).not.toHaveBeenCalled();
  });
  it("returns a durable replay result after an uncertain prior response", async () => {
    const mock = service();
    mock.workerCycle.mockResolvedValueOnce({ replayed: true, items: [] });
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123" }), "WORKER_CYCLE", { service: mock, token: "test-worker-token" });
    expect(await response.json()).toEqual({ replayed: true, items: [] });
  });
  it("executes begin attempt with bounded input", async () => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:begin", workerId: "worker-123", workKind: "ORIGINAL", idempotencyKey: "key", leaseToken: "00000000-0000-0000-0000-000000000001" }), "BEGIN_ATTEMPT", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(200);
    expect(mock.beginAttempt).toHaveBeenCalledTimes(1);
  });
  it("executes complete attempt with bounded result", async () => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:complete", workerId: "worker-123", workKind: "ORIGINAL", idempotencyKey: "key", leaseToken: "00000000-0000-0000-0000-000000000001", attemptNumber: 1, resultClass: "ACKNOWLEDGED", httpStatus: 200, jitterFraction: 0 }), "COMPLETE_ATTEMPT", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(200);
    expect(mock.completeAttempt).toHaveBeenCalledTimes(1);
  });
  it("rejects out-of-range completion jitter", async () => {
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:complete", workerId: "worker-123", workKind: "ORIGINAL", idempotencyKey: "key", leaseToken: "token", attemptNumber: 1, resultClass: "RETRYABLE", jitterFraction: 0.3 }), "COMPLETE_ATTEMPT", { service: service(), token: "test-worker-token" });
    expect(response.status).toBe(400);
  });
  it("rejects unknown request fields before service execution", async () => {
    const mock = service();
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123", sql: "SELECT 1" }), "WORKER_CYCLE", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(400);
    expect(mock.workerCycle).not.toHaveBeenCalled();
  });
  it("maps command conflicts without leaking details", async () => {
    const mock = service();
    mock.workerCycle.mockRejectedValueOnce(new Error("GLW_WORKER_COMMAND_CONFLICT") as never);
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123" }), "WORKER_CYCLE", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toMatch(/password|postgresql:\/\//i);
  });
  it("maps database rollback or transient unavailability to a bounded 503", async () => {
    const mock = service();
    mock.workerCycle.mockRejectedValueOnce(new Error("connection terminated") as never);
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123" }), "WORKER_CYCLE", { service: mock, token: "test-worker-token" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "WORKER_COMMAND_UNAVAILABLE" });
  });
  it("rejects an invocation when the bounded gate is exhausted", async () => {
    const invocationGate = { enter: jest.fn(() => false), leave: jest.fn() };
    const response = await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123" }), "WORKER_CYCLE", { service: service(), token: "test-worker-token", invocationGate });
    expect(response.status).toBe(429);
    expect(invocationGate.leave).not.toHaveBeenCalled();
  });
  it("releases the bounded gate after a command finishes", async () => {
    const invocationGate = { enter: jest.fn(() => true), leave: jest.fn() };
    await handleGlwProducerWorkerCommand(request({ commandId: "execution:123:cycle", workerId: "worker-123", instanceId: "instance-123" }), "WORKER_CYCLE", { service: service(), token: "test-worker-token", invocationGate });
    expect(invocationGate.leave).toHaveBeenCalledWith("worker-123");
  });
});