import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { RequestPrincipal } from "@/modules/foundation/api-auth";
import type { GlwGenerationRequest } from "@/modules/glw/page-generation";

const principal: RequestPrincipal = {
  principalId: "operator:staging",
  sessionId: "session:staging",
};

function createRequest(): GlwGenerationRequest {
  return {
    organizationId: "pageengines",
    siteId: "site-pageengines-pageengines-staging",
    productId: "prod-123",
    pageType: "general_service",
    slug: "home",
    canonicalPath: "/home",
    plannedOperation: "CREATE_GENERAL",
    publicationIntent: "draft",
    sourceControl: "manual",
    stage2Data: null,
  };
}

function withModule<T>(run: () => T): T {
  let result: T | null = null;
  jest.isolateModules(() => {
    result = run();
  });
  return result as T;
}

describe("PageEngines one-shot live execution guard", () => {
  const previousEnv = process.env;
  let persistenceDir = "";

  beforeEach(() => {
    persistenceDir = mkdtempSync(join(tmpdir(), "pageengines-one-shot-"));
    process.env = {
      ...previousEnv,
      GCP_FOUNDATION_PERSISTENCE_DIR: persistenceDir,
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_ENABLED: "true",
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_GRANT_ID: "grant-1",
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_EXPIRES_AT: "2999-01-01T00:00:00.000Z",
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_ORGANIZATION_ID: "pageengines",
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_SITE_ID: "site-pageengines-pageengines-staging",
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_WORKFLOW_ID: "bIDXxyWnY22G8zJC",
      GENESIS_PAGEENGINES_ONE_SHOT_LIVE_SLUG: "home",
    };
  });

  afterEach(() => {
    process.env = previousEnv;
    rmSync(persistenceDir, { recursive: true, force: true });
    jest.resetModules();
  });

  test("consumes authorization once and blocks replay", () => {
    const request = createRequest();

    const first = withModule(() => {
      const { authorizeAndConsumePageenginesOneShotLiveExecution } = require("@/modules/glw/pageengines-one-shot-live-execution");
      return authorizeAndConsumePageenginesOneShotLiveExecution({
        request,
        action: "generate_review_only",
        workflowId: "bIDXxyWnY22G8zJC",
        principal,
      });
    });
    expect(first.ok).toBe(true);

    const replay = withModule(() => {
      const { authorizeAndConsumePageenginesOneShotLiveExecution } = require("@/modules/glw/pageengines-one-shot-live-execution");
      return authorizeAndConsumePageenginesOneShotLiveExecution({
        request,
        action: "generate_review_only",
        workflowId: "bIDXxyWnY22G8zJC",
        principal,
      });
    });
    expect(replay).toMatchObject({
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_ALREADY_CONSUMED",
      status: 409,
    });
  });

  test("rejects scope mismatch", () => {
    const request = createRequest();
    request.siteId = "site-other";

    const result = withModule(() => {
      const { authorizeAndConsumePageenginesOneShotLiveExecution } = require("@/modules/glw/pageengines-one-shot-live-execution");
      return authorizeAndConsumePageenginesOneShotLiveExecution({
        request,
        action: "generate_review_only",
        workflowId: "bIDXxyWnY22G8zJC",
        principal,
      });
    });
    expect(result).toMatchObject({
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_SCOPE_MISMATCH",
      status: 403,
    });
  });

  test("rejects invalid request shape", () => {
    const request = createRequest();
    request.publicationIntent = "publish";

    const result = withModule(() => {
      const { authorizeAndConsumePageenginesOneShotLiveExecution } = require("@/modules/glw/pageengines-one-shot-live-execution");
      return authorizeAndConsumePageenginesOneShotLiveExecution({
        request,
        action: "generate_review_only",
        workflowId: "bIDXxyWnY22G8zJC",
        principal,
      });
    });
    expect(result).toMatchObject({
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_REQUEST_INVALID",
      status: 409,
    });
  });
});
