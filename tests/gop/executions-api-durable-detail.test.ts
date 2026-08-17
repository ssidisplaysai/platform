import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });

import {
  handleGetExecutionById,
  handleGetExecutionHistory,
  handleGetJobExecution,
  handleListExecutions,
} from "@/lib/gop/executions-api";
import {
  createExecutionSnapshot,
  createGenesisExecution,
  createGenesisOrchestrationRuntime,
  createInMemoryExecutionRepository,
} from "@/platform/gop";

const sessionLoader = async () => ({
  email: "operator@example.com",
  expiresAt: Date.now() + 60_000,
});

const originalAdminEmail = process.env.GLW_ADMIN_EMAIL;

beforeAll(() => {
  process.env.GLW_ADMIN_EMAIL = "operator@example.com";
});

afterAll(() => {
  if (originalAdminEmail === undefined) {
    delete process.env.GLW_ADMIN_EMAIL;
  } else {
    process.env.GLW_ADMIN_EMAIL = originalAdminEmail;
  }
});

function execution(input: {
  executionId?: string;
  jobId?: string;
  status: "DISPATCHED" | "RUNNING" | "SUCCEEDED";
  outputStatus: "RUNNING" | "COMPLETE";
}) {
  return {
    ...createGenesisExecution({
      executionId: input.executionId ?? "gexec_detail_1",
      executionType: "PAGE_GENERATION",
      jobId: input.jobId ?? "job_detail_1",
      workspaceId: "glw-led-display-warehouse",
      moduleId: "glw.core",
      jobType: "PAGE_GENERATION",
      queueName: "glw-default",
    }),
    status: input.status,
    output: { status: input.outputStatus, executionId: "74484" },
  };
}

async function staleRuntimeFixture() {
  const stale = execution({ status: "DISPATCHED", outputStatus: "RUNNING" });
  const repository = createInMemoryExecutionRepository([stale]);
  const runtime = createGenesisOrchestrationRuntime({
    repository,
  });
  await runtime.ensureRecovered();
  expect(runtime.getExecutionById(stale.executionId)?.status).toBe("WAITING");
  return { runtime, repository, stale };
}

describe("GOP durable execution detail reads", () => {
  it("uses durable terminal state over stale in-memory execution detail", async () => {
    const { runtime, repository, stale } = await staleRuntimeFixture();
    const durable = execution({ status: "SUCCEEDED", outputStatus: "COMPLETE" });
    await repository.saveExecution(durable);

    const response = await handleGetExecutionById(stale.executionId, { runtime, repository, sessionLoader });
    const payload = await response.json();

    expect(payload.execution).toMatchObject({ status: "SUCCEEDED", output: { status: "COMPLETE" } });
  });

  it("uses durable terminal state for job-linked detail", async () => {
    const { runtime, repository, stale } = await staleRuntimeFixture();
    const durable = execution({ status: "SUCCEEDED", outputStatus: "COMPLETE" });
    await repository.saveExecution(durable);

    const response = await handleGetJobExecution(stale.jobId!, { runtime, repository, sessionLoader });
    const payload = await response.json();

    expect(payload.execution).toMatchObject({ status: "SUCCEEDED", output: { status: "COMPLETE" } });
  });

  it("keeps durable list and execution detail consistent", async () => {
    const { runtime, repository, stale } = await staleRuntimeFixture();
    const durable = execution({ status: "SUCCEEDED", outputStatus: "COMPLETE" });
    await repository.saveExecution(durable);

    const [listResponse, detailResponse] = await Promise.all([
      handleListExecutions(new Request("http://localhost/api/gop/executions"), { runtime, repository, sessionLoader }),
      handleGetExecutionById(stale.executionId, { runtime, repository, sessionLoader }),
    ]);
    const list = await listResponse.json();
    const detail = await detailResponse.json();

    expect(detail.execution).toMatchObject(list.executions[0]);
  });

  it("keeps durable list and job detail consistent", async () => {
    const { runtime, repository, stale } = await staleRuntimeFixture();
    const durable = execution({ status: "SUCCEEDED", outputStatus: "COMPLETE" });
    await repository.saveExecution(durable);

    const [listResponse, detailResponse] = await Promise.all([
      handleListExecutions(new Request("http://localhost/api/gop/executions"), { runtime, repository, sessionLoader }),
      handleGetJobExecution(stale.jobId!, { runtime, repository, sessionLoader }),
    ]);
    const list = await listResponse.json();
    const detail = await detailResponse.json();

    expect(detail.execution).toMatchObject(list.executions[0]);
  });

  it("returns terminal durable detail when recovery maps do not contain it", async () => {
    const durable = execution({ status: "SUCCEEDED", outputStatus: "COMPLETE" });
    const repository = createInMemoryExecutionRepository([durable]);
    const runtime = createGenesisOrchestrationRuntime({ repository });
    await runtime.ensureRecovered();
    expect(runtime.getExecutionById(durable.executionId)).toBeNull();

    const response = await handleGetExecutionById(durable.executionId, { runtime, repository, sessionLoader });
    const payload = await response.json();

    expect(payload.execution).toMatchObject({ status: "SUCCEEDED", output: { status: "COMPLETE" } });
  });

  it("preserves active durable execution behavior", async () => {
    const active = execution({ status: "RUNNING", outputStatus: "RUNNING" });
    const repository = createInMemoryExecutionRepository([active]);
    const runtime = createGenesisOrchestrationRuntime({ repository });

    const response = await handleGetExecutionById(active.executionId, { runtime, repository, sessionLoader });
    const payload = await response.json();

    expect(payload.execution).toMatchObject({ status: "RUNNING", output: { status: "RUNNING" } });
  });

  it("preserves missing execution responses", async () => {
    const repository = createInMemoryExecutionRepository();
    const runtime = createGenesisOrchestrationRuntime({ repository });

    const [executionResponse, jobResponse] = await Promise.all([
      handleGetExecutionById("missing", { runtime, repository, sessionLoader }),
      handleGetJobExecution("missing", { runtime, repository, sessionLoader }),
    ]);

    await expect(executionResponse.json()).resolves.toEqual({ execution: null });
    await expect(jobResponse.json()).resolves.toEqual({ execution: null });
  });

  it("uses durable execution and history without writing on GET", async () => {
    const durable = execution({ status: "SUCCEEDED", outputStatus: "COMPLETE" });
    const repository = createInMemoryExecutionRepository([durable]);
    const snapshot = createExecutionSnapshot({ execution: durable, snapshotSequence: 1 });
    await repository.storeSnapshot(snapshot);
    const saveExecution = jest.spyOn(repository, "saveExecution");
    const storeSnapshot = jest.spyOn(repository, "storeSnapshot");
    const runtime = createGenesisOrchestrationRuntime({ repository });

    const response = await handleGetExecutionHistory(durable.executionId, { runtime, repository, sessionLoader });
    const payload = await response.json();

    expect(payload.execution.status).toBe("SUCCEEDED");
    expect(payload.history).toHaveLength(1);
    expect(saveExecution).not.toHaveBeenCalled();
    expect(storeSnapshot).not.toHaveBeenCalled();
  });
});