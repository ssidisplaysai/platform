jest.mock("server-only", () => ({}));

const persisted = new Map<string, { revision: number; state: unknown }>();
jest.mock("@/modules/foundation/foundation-persistence", () => ({
  deepClone: <T,>(value: T): T => structuredClone(value),
  loadPersistedState: <T,>(input: { namespace: string; seedFactory: () => T }) => {
    const current = persisted.get(input.namespace);
    return current ? { revision: current.revision, state: structuredClone(current.state) as T } : { revision: 0, state: input.seedFactory() };
  },
  savePersistedState: <T,>(input: { namespace: string; state: T; expectedRevision: number }) => {
    persisted.set(input.namespace, { revision: input.expectedRevision + 1, state: structuredClone(input.state) });
    return { revision: input.expectedRevision + 1 };
  },
}));

import {
  glwPageExecutionRepository,
  reconcileGlwOrphanedPageExecution,
} from "../page-execution-repository";
import type { GlwPageExecutionRecord } from "../page-execution";

function execution(status: GlwPageExecutionRecord["status"]): GlwPageExecutionRecord {
  return {
    jobId: "job-1",
    correlationId: "job-1",
    executionTransport: "N8N_MCP",
    organizationId: "ssi",
    siteId: "site-ssi-screen-solutions-international",
    productId: "product-1",
    productTopic: "Product",
    state: "Texas",
    city: "Austin",
    slug: "product/texas/austin",
    title: "Product in Austin",
    seoTitle: "Product in Austin",
    metaDescription: "Description",
    publicationIntent: "draft",
    status,
    externalExecutionId: "320913",
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    errorCode: null,
    errorMessage: null,
    requestedPublicationMode: "draft",
    disposition: null,
    qaStatus: null,
    qaChecks: null,
    qaFailureReasons: null,
    focusKeyphrase: null,
    wordCount: null,
    featuredImagePresent: null,
    createdAt: "2026-08-31T00:36:59.699Z",
    dispatchedAt: "2026-08-31T00:36:59.710Z",
    updatedAt: "2026-08-31T00:37:14.794Z",
    completedAt: null,
  };
}

describe("GLW operational execution reconciliation", () => {
  beforeEach(() => persisted.clear());

  test("terminalizes an exact orphan with durable non-mutation evidence", async () => {
    await glwPageExecutionRepository.create(execution("RUNNING"));
    const reconciled = await reconcileGlwOrphanedPageExecution({
      jobId: "job-1",
      externalExecutionId: "320913",
      n8nExecutionNotRetained: true,
      campaignTargetBindingAbsent: true,
      activeLeaseAbsent: true,
      reconciledBy: "platform_admin",
      reconciledAt: "2026-09-13T00:00:00.000Z",
    });

    expect(reconciled).toMatchObject({
      status: "FAILED",
      errorCode: "EXECUTION_ORPHANED",
      wordpressObjectId: null,
      completedAt: "2026-09-13T00:00:00.000Z",
      qaChecks: {
        operationalReconciliation: {
          classification: "ORPHANED",
          priorStatus: "RUNNING",
          externalExecutionId: "320913",
          wordpressMutationPerformed: false,
          dispatchPerformed: false,
        },
      },
    });
  });

  test("rejects a mismatched external execution identity", async () => {
    await glwPageExecutionRepository.create(execution("DISPATCHED"));
    await expect(reconcileGlwOrphanedPageExecution({
      jobId: "job-1",
      externalExecutionId: "wrong",
      n8nExecutionNotRetained: true,
      campaignTargetBindingAbsent: true,
      activeLeaseAbsent: true,
      reconciledBy: "platform_admin",
    })).rejects.toThrow("exact external execution identity");
  });

  test("does not rewrite content-ready terminal evidence", async () => {
    await glwPageExecutionRepository.create(execution("CONTENT_READY"));
    await expect(reconcileGlwOrphanedPageExecution({
      jobId: "job-1",
      externalExecutionId: "320913",
      n8nExecutionNotRetained: true,
      campaignTargetBindingAbsent: true,
      activeLeaseAbsent: true,
      reconciledBy: "platform_admin",
    })).rejects.toThrow("dispatched or running");
  });
});