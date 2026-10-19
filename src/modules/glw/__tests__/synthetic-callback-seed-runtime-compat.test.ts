import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  applyGlwN8nReconnectCallback,
  GLW_N8N_CALLBACK_SECRET_ENV,
  GLW_N8N_RECONNECT_ENABLED_ENV,
} from "../n8n-reconnect";
import { createInMemoryGlwPageExecutionRepository } from "../page-execution";
import {
  createSyntheticGlwCallbackSeed,
  GLW_SYNTHETIC_CALLBACK_DISPOSITION,
  GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
  GLW_SYNTHETIC_CALLBACK_SITE_ID,
} from "../synthetic-callback-seed";

const AUTH_HEADER = "Bearer callback-secret";

describe("synthetic callback runtime utility compatibility", () => {
  test("runtime utility persistence is repository-compatible and callback-safe", async () => {
    const persistenceDir = mkdtempSync(join(tmpdir(), "glw-seed-runtime-compat-"));
    const scriptPath = join(process.cwd(), "scripts", "glw-seed-synthetic-callback-job-runtime.cjs");
    const ownerApprovalId = "OWNER_APPROVAL-GLW-PHASE4D-RUNTIME-COMPAT-001";
    const executionId = "synthetic-execution-runtime-001";
    const expectedJobId = `glw-synthetic-callback-${ownerApprovalId.toLowerCase()}`;

    const seedProbe = createInMemoryGlwPageExecutionRepository();
    const expectedSeed = await createSyntheticGlwCallbackSeed({
      ownerApprovalId,
      executionId,
      repository: seedProbe,
      environment: { GENESIS_ENVIRONMENT: "staging" },
      now: () => "2031-01-01T00:00:00.000Z",
    });

    try {
      process.env.GCP_FOUNDATION_PERSISTENCE_DIR = persistenceDir;
      jest.resetModules();
      const repositoryModule = await import("../page-execution-repository");
      const repository = repositoryModule.glwPageExecutionRepository;

      const unrelated = await repository.create({
        jobId: "normal-job-preserved-001",
        correlationId: "normal-job-preserved-001",
        executionTransport: "N8N_WEBHOOK",
        organizationId: GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
        siteId: GLW_SYNTHETIC_CALLBACK_SITE_ID,
        productId: "prod-indoor-led-video-wall",
        productTopic: "LED Video Wall",
        state: "Texas",
        city: "Austin",
        slug: "indoor-led-video-wall/texas/austin",
        title: "Normal record",
        seoTitle: "Normal record",
        metaDescription: "Normal record",
        publicationIntent: "draft",
        status: "DISPATCHED",
        externalExecutionId: "normal-execution-001",
        wordpressObjectId: null,
        wordpressUrl: null,
        wordpressStatus: null,
        generatedDraft: null,
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
        createdAt: "2031-01-01T00:00:00.000Z",
        dispatchedAt: "2031-01-01T00:00:00.000Z",
        updatedAt: "2031-01-01T00:00:00.000Z",
        completedAt: null,
      });

      const seed = spawnSync(
        process.execPath,
        [
          scriptPath,
          "--owner-approval-id",
          ownerApprovalId,
          "--execution-id",
          executionId,
          "--confirm",
          "SEED-SYNTHETIC-CALLBACK-JOB",
        ],
        {
          env: {
            ...process.env,
            GENESIS_ENVIRONMENT: "staging",
            GCP_FOUNDATION_PERSISTENCE_DIR: persistenceDir,
          },
          encoding: "utf-8",
        },
      );
      expect(seed.status).toBe(0);
      expect(seed.stderr).toBe("");

      const persistedEnvelope = JSON.parse(
        readFileSync(join(persistenceDir, "glw-page-execution-repository.json"), "utf-8"),
      ) as {
        schemaVersion: number;
        revision: number;
        data: { records: Array<{ jobId: string }> };
      };
      expect(persistedEnvelope.schemaVersion).toBe(1);
      expect(persistedEnvelope.revision).toBeGreaterThanOrEqual(2);
      expect(persistedEnvelope.data.records.some((record) => record.jobId === unrelated.jobId)).toBe(true);
      expect(persistedEnvelope.data.records.some((record) => record.jobId === expectedJobId)).toBe(true);

      const seeded = await repository.getById(expectedJobId);
      expect(seeded).not.toBeNull();
      expect(seeded).toMatchObject({
        jobId: expectedSeed.jobId,
        organizationId: expectedSeed.organizationId,
        siteId: expectedSeed.siteId,
        productId: expectedSeed.productId,
        status: expectedSeed.status,
        executionTransport: expectedSeed.executionTransport,
        externalExecutionId: expectedSeed.externalExecutionId,
        disposition: GLW_SYNTHETIC_CALLBACK_DISPOSITION,
      });
      expect(seeded?.qaChecks).toMatchObject({
        syntheticCallbackSeed: {
          ownerApprovalId,
          stagingOnly: true,
          nonCustomer: true,
          retentionPolicy: "RETAIN_UNTIL_OWNER_CLEANUP",
        },
      });

      const running = await applyGlwN8nReconnectCallback({
        authorizationHeader: AUTH_HEADER,
        payload: {
          jobId: expectedJobId,
          executionId,
          status: "RUNNING",
          organizationId: GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
          siteId: GLW_SYNTHETIC_CALLBACK_SITE_ID,
        },
        repository,
        environment: {
          [GLW_N8N_RECONNECT_ENABLED_ENV]: "true",
          [GLW_N8N_CALLBACK_SECRET_ENV]: "callback-secret",
        },
      });
      expect(running).toMatchObject({ ok: true, code: "CALLBACK_APPLIED", status: 200 });

      const replay = await applyGlwN8nReconnectCallback({
        authorizationHeader: AUTH_HEADER,
        payload: {
          jobId: expectedJobId,
          executionId,
          status: "RUNNING",
        },
        repository,
        environment: {
          [GLW_N8N_RECONNECT_ENABLED_ENV]: "true",
          [GLW_N8N_CALLBACK_SECRET_ENV]: "callback-secret",
        },
      });
      expect(replay).toMatchObject({ ok: true, code: "IDEMPOTENT_REPLAY", status: 200 });

      const unrelatedAfter = await repository.getById(unrelated.jobId);
      expect(unrelatedAfter).toEqual(unrelated);
    } finally {
      delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
      jest.resetModules();
      rmSync(persistenceDir, { recursive: true, force: true });
    }
  });
});
