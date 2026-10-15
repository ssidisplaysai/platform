import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import { FOUNDATION_SITE_FIXTURES } from "@/modules/foundation/site-fixtures";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
} from "../page-generation";
import {
  createGlwDraftExecutionService,
  createInMemoryGlwPageExecutionRepository,
} from "../page-execution";
import {
  applyGlwN8nReconnectCallback,
  GLW_N8N_CALLBACK_SECRET_ENV,
  GLW_N8N_NON_MUTATING_TEST_ENV,
  GLW_N8N_RECONNECT_ENABLED_ENV,
} from "../n8n-reconnect";

const site = adaptSiteForGeneration(FOUNDATION_SITE_FIXTURES[0]);
const product = adaptProductForGeneration(FOUNDATION_PRODUCTS[0], site.siteId);
const preview = buildLocalGlwGenerationPreview({
  form: createDefaultGlwGenerationInput(site, product),
  sites: [site],
  products: [product],
});

function reconnectEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [GLW_N8N_RECONNECT_ENABLED_ENV]: "true",
    [GLW_N8N_CALLBACK_SECRET_ENV]: "callback-secret",
    ...overrides,
  };
}

async function createQueuedJob() {
  const repository = createInMemoryGlwPageExecutionRepository();
  const service = createGlwDraftExecutionService({
    repository,
    dispatcher: {
      async dispatch() {
        return { kind: "accepted", executionId: "700001", status: "accepted" } as const;
      },
    },
    createJobId: () => "reconnect-job-001",
    now: () => "2030-01-01T00:00:00.000Z",
  });
  const result = await service.execute(preview.request!);
  return { repository, job: result };
}

describe("GLW n8n reconnect callback gate", () => {
  test("rejects callback requests when the feature flag is disabled", async () => {
    const { repository } = await createQueuedJob();
    const result = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: { jobId: "reconnect-job-001", executionId: "700001", status: "RUNNING" },
      repository,
      environment: reconnectEnvironment({ [GLW_N8N_RECONNECT_ENABLED_ENV]: "false" }),
    });
    expect(result).toMatchObject({ ok: false, code: "FEATURE_DISABLED", status: 404 });
  });

  test("requires bearer authentication and binds execution identity", async () => {
    const { repository } = await createQueuedJob();
    const unauthorized = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer wrong-secret",
      payload: { jobId: "reconnect-job-001", executionId: "700001", status: "RUNNING" },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(unauthorized).toMatchObject({ ok: false, code: "CALLBACK_UNAUTHORIZED", status: 401 });

    const accepted = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: { jobId: "reconnect-job-001", executionId: "700001", status: "RUNNING" },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.job).toMatchObject({ status: "RUNNING", externalExecutionId: "700001" });

    const mismatchedExecution = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: { jobId: "reconnect-job-001", executionId: "700999", status: "RUNNING" },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(mismatchedExecution).toMatchObject({ ok: false, code: "EXECUTION_MISMATCH", status: 409 });
  });

  test("enforces site and organization isolation", async () => {
    const { repository } = await createQueuedJob();
    const siteMismatch = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: {
        jobId: "reconnect-job-001",
        executionId: "700001",
        status: "RUNNING",
        siteId: "wrong-site",
      },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(siteMismatch).toMatchObject({ ok: false, code: "SITE_MISMATCH", status: 409 });

    const organizationMismatch = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: {
        jobId: "reconnect-job-001",
        executionId: "700001",
        status: "RUNNING",
        organizationId: "wrong-organization",
      },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(organizationMismatch).toMatchObject({ ok: false, code: "ORGANIZATION_MISMATCH", status: 409 });
  });

  test("keeps callback completion authority inside Genesis and blocks WordPress override fields", async () => {
    const { repository } = await createQueuedJob();
    const blockedComplete = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: { jobId: "reconnect-job-001", executionId: "700001", status: "COMPLETE" },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(blockedComplete).toMatchObject({ ok: false, code: "UNAUTHORIZED_COMPLETE", status: 409 });

    const blockedWordPressFields = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: {
        jobId: "reconnect-job-001",
        executionId: "700001",
        status: "CONTENT_READY",
        generatedDraft: {
          title: "Draft title",
          contentHtml: "<p>Draft body</p>",
          slug: "direct-view-led-video-walls/texas/austin",
        },
        wordpressPageId: 12345,
      },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(blockedWordPressFields).toMatchObject({ ok: false, code: "WORDPRESS_AUTHORITY_REJECTED", status: 409 });
  });

  test("supports idempotent callback replay and durable content-ready transition in non-mutating mode", async () => {
    const { repository } = await createQueuedJob();
    const initialRunning = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: { jobId: "reconnect-job-001", executionId: "700001", status: "RUNNING" },
      repository,
      environment: reconnectEnvironment({ [GLW_N8N_NON_MUTATING_TEST_ENV]: "true" }),
    });
    expect(initialRunning.ok).toBe(true);

    const contentReadyPayload = {
      jobId: "reconnect-job-001",
      executionId: "700001",
      status: "CONTENT_READY",
      generatedDraft: {
        title: "Draft title",
        contentHtml: "<p>Draft body one two three four five</p>",
        slug: "direct-view-led-video-walls/texas/austin",
        seoTitle: "Draft SEO title",
      },
    };

    const first = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: contentReadyPayload,
      repository,
      environment: reconnectEnvironment({ [GLW_N8N_NON_MUTATING_TEST_ENV]: "true" }),
    });
    expect(first.ok).toBe(true);
    expect(first.job).toMatchObject({
      status: "CONTENT_READY",
      wordpressObjectId: null,
      wordpressUrl: null,
      wordpressStatus: null,
    });

    const replay = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: contentReadyPayload,
      repository,
      environment: reconnectEnvironment({ [GLW_N8N_NON_MUTATING_TEST_ENV]: "true" }),
    });
    expect(replay).toMatchObject({ ok: true, code: "IDEMPOTENT_REPLAY", status: 200 });
  });

  test("accepts terminal failure callback and records failed status", async () => {
    const { repository } = await createQueuedJob();
    const failed = await applyGlwN8nReconnectCallback({
      authorizationHeader: "Bearer callback-secret",
      payload: {
        jobId: "reconnect-job-001",
        executionId: "700001",
        status: "FAILED",
        error: { message: "n8n execution failed in synthetic test mode." },
      },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(failed.ok).toBe(true);
    expect(failed.job).toMatchObject({
      status: "FAILED",
      errorCode: "N8N_EXECUTION_FAILED",
      externalExecutionId: "700001",
    });
  });
});
