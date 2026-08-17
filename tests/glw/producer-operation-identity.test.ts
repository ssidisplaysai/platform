import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { deriveGlwCallbackIdentity } from "@/lib/glw/callback-idempotency";
import {
  buildGlwProducerTerminalPayload,
  createGlwProducerOperationIdentity,
} from "@/lib/glw/producer-callback-contract";
import { createInMemoryGlwJobRepository } from "@/lib/glw/job-repository";
import { createGlwJobInput, createGlwJobRecord } from "@/lib/glw/jobs";
import { retryGlwPageGenerationJob, submitGlwPageGenerationJob } from "@/lib/glw/page-generation";
import type { GlwN8nTransport } from "@/lib/glw/n8n";
import * as orchestrationRuntime from "@/platform/gop/runtime/orchestration-runtime";

const request = {
  siteId: "led-display-warehouse",
  workspaceId: "glw-led-display-warehouse",
  pageType: "city_service" as const,
  productTopic: "LED wall rental",
  state: "California",
  city: "Los Angeles",
  citySlug: "los-angeles",
  hierarchicalSlug: "california/los-angeles/led-wall-rental",
  additionalInstructions: "Focus on same-day deployment for venue operators.",
  title: "LED Wall Rental Package",
  targetSlug: "led-wall-rental-package",
  primaryKeyword: "led wall rental",
  secondaryKeywords: ["event led wall", "mobile led display"],
  wordCount: 1500,
  tone: "Confident",
  audience: "Event planners",
  callToAction: "Request a same-day quote",
  category: "Rentals",
  status: "draft" as const,
};

describe("HR-004 Slice C producer identity", () => {
  beforeEach(() => {
    jest.spyOn(orchestrationRuntime, "getGenesisOrchestrationRuntime").mockReturnValue({
      createGlwExecutionForJob: () => undefined,
      syncGlwExecutionState: () => undefined,
    } as unknown as ReturnType<typeof orchestrationRuntime.getGenesisOrchestrationRuntime>);
  });

  it("creates namespaced operation and publication identities once", () => {
    const uuids = ["operation-uuid", "publication-uuid"];
    const identity = createGlwProducerOperationIdentity(undefined, () => uuids.shift()!);
    expect(identity).toEqual({
      operationKey: "glw-op-v1:operation-uuid",
      publicationKey: "glw-publication-v1:publication-uuid",
    });
  });

  it("preserves existing identity across replay", () => {
    const existing = {
      operationKey: "glw-op-v1:existing-operation",
      publicationKey: "glw-publication-v1:existing-publication",
    };
    expect(createGlwProducerOperationIdentity(existing, () => "must-not-be-used")).toEqual(existing);
  });

  it("builds the exact certified Slice B callback-v2 identity", () => {
    const payload = buildGlwProducerTerminalPayload({
      jobId: "job-1",
      executionId: "execution-1",
      status: "FAILED",
      error: { code: "TEST", message: "failed", step: "qa" },
    }, "glw-op-v1:operation-1");
    const receiverIdentity = deriveGlwCallbackIdentity(payload);

    expect(payload).toMatchObject({
      callbackVersion: "2",
      operationKey: "glw-op-v1:operation-1",
      idempotencyKey: "glw-callback-v2:glw-op-v1:operation-1:job-1:execution-1:PAGE_GENERATION_TERMINAL:FAILED",
      terminalScopeKey: "glw-terminal-v2:glw-op-v1:operation-1:job-1:execution-1:PAGE_GENERATION_TERMINAL",
      callbackType: "PAGE_GENERATION_TERMINAL",
      payloadSha256: receiverIdentity.payloadSha256,
    });
    expect(receiverIdentity.mode).toBe("V2");
  });

  it("produces stable payload identity for exact replay", () => {
    const semanticPayload = { jobId: "job-1", executionId: "execution-1", status: "FAILED" as const, error: { message: "failed" } };
    expect(buildGlwProducerTerminalPayload(semanticPayload, "glw-op-v1:operation-1"))
      .toEqual(buildGlwProducerTerminalPayload(semanticPayload, "glw-op-v1:operation-1"));
  });

  it("rejects a missing operation identity", () => {
    expect(() => buildGlwProducerTerminalPayload({
      jobId: "job-1",
      executionId: "execution-1",
      status: "FAILED",
      error: { message: "failed" },
    }, " ")).toThrow("operation identity");
  });

  it("persists identity before dispatch and propagates it to n8n", async () => {
    const repository = createInMemoryGlwJobRepository();
    const workflow = { invokePageGeneration: jest.fn(async () => ({ kind: "accepted" as const, executionId: "execution-1", status: "accepted" as const })) };
    const identity = { operationKey: "glw-op-v1:operation-1", publicationKey: "glw-publication-v1:publication-1" };
    const result = await submitGlwPageGenerationJob(request, {
      repository,
      workflow: workflow as unknown as GlwN8nTransport,
      appUrl: "http://localhost:3000",
    }, undefined, identity);

    expect(result.job).toMatchObject(identity);
    expect(workflow.invokePageGeneration).toHaveBeenCalledWith(expect.objectContaining(identity));
  });

  it("inherits operation and publication identity across an authorized retry", async () => {
    const original = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "FAILED",
      retryOfJobId: null,
      siteId: request.siteId,
      title: request.title,
      input: createGlwJobInput(request, "http://localhost/api/glw/jobs/callback"),
      result: null,
      error: { message: "failed" },
      externalExecutionId: "execution-original",
      operationKey: "glw-op-v1:operation-1",
      publicationKey: "glw-publication-v1:publication-1",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    const repository = createInMemoryGlwJobRepository([original]);
    const workflow = { invokePageGeneration: jest.fn(async () => ({ kind: "accepted" as const, executionId: "execution-retry", status: "accepted" as const })) };
    const result = await retryGlwPageGenerationJob(original.id, {
      repository,
      workflow: workflow as unknown as GlwN8nTransport,
      appUrl: "http://localhost:3000",
    });

    expect(result.job).toMatchObject({ operationKey: original.operationKey, publicationKey: original.publicationKey });
  });

  it("resolves persisted operation identity through repository authority", async () => {
    const job = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "QUEUED",
      retryOfJobId: null,
      siteId: request.siteId,
      title: request.title,
      input: createGlwJobInput(request, "http://localhost/api/glw/jobs/callback"),
      result: null,
      error: null,
      externalExecutionId: null,
      operationKey: "glw-op-v1:lookup",
      publicationKey: "glw-publication-v1:lookup",
      startedAt: null,
      completedAt: null,
    });
    const repository = createInMemoryGlwJobRepository([job]);
    expect(await repository.findByOperationKey("glw-op-v1:lookup")).toEqual(job);
    expect(await repository.findByOperationKey("glw-op-v1:missing")).toBeNull();
  });
});