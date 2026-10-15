import {
  applyGlwN8nReconnectCallback,
  GLW_N8N_CALLBACK_SECRET_ENV,
  GLW_N8N_RECONNECT_ENABLED_ENV,
} from "../n8n-reconnect";
import {
  createInMemoryGlwPageExecutionRepository,
  type GlwPageExecutionRecord,
  type GlwPageExecutionRepository,
} from "../page-execution";
import {
  createSyntheticGlwCallbackSeed,
  GLW_SYNTHETIC_CALLBACK_DISPOSITION,
  GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
  GLW_SYNTHETIC_CALLBACK_SITE_ID,
} from "../synthetic-callback-seed";

const AUTH_HEADER = "Bearer callback-secret";

type RepositoryCallCounts = {
  create: number;
  getById: number;
  list: number;
  update: number;
};

function wrapRepository(base: GlwPageExecutionRepository) {
  const counts: RepositoryCallCounts = { create: 0, getById: 0, list: 0, update: 0 };
  const repository: GlwPageExecutionRepository = {
    async create(record) {
      counts.create += 1;
      return base.create(record);
    },
    async getById(jobId) {
      counts.getById += 1;
      return base.getById(jobId);
    },
    async list() {
      counts.list += 1;
      return base.list();
    },
    async update(jobId, patch) {
      counts.update += 1;
      return base.update(jobId, patch);
    },
  };
  return { repository, counts };
}

function reconnectEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    [GLW_N8N_RECONNECT_ENABLED_ENV]: "true",
    [GLW_N8N_CALLBACK_SECRET_ENV]: "callback-secret",
    ...overrides,
  };
}

async function seedRecord(input?: { repository?: GlwPageExecutionRepository; ownerApprovalId?: string; executionId?: string }) {
  const repository = input?.repository ?? createInMemoryGlwPageExecutionRepository();
  return createSyntheticGlwCallbackSeed({
    ownerApprovalId: input?.ownerApprovalId ?? "OWNER_APPROVAL-GLW-PHASE4D-TEST-001",
    executionId: input?.executionId ?? "synthetic-execution-001",
    repository,
    environment: { GENESIS_ENVIRONMENT: "staging" },
    now: () => "2031-01-01T00:00:00.000Z",
  });
}

describe("synthetic callback seed", () => {
  test("creates exactly one staging-only synthetic record with fixed binding and durable readback", async () => {
    const repository = createInMemoryGlwPageExecutionRepository();
    const seeded = await seedRecord({ repository });
    const readback = await repository.getById(seeded.jobId);

    expect(readback).not.toBeNull();
    expect(readback).toMatchObject({
      jobId: "glw-synthetic-callback-owner_approval-glw-phase4d-test-001",
      status: "DISPATCHED",
      externalExecutionId: "synthetic-execution-001",
      organizationId: GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
      siteId: GLW_SYNTHETIC_CALLBACK_SITE_ID,
      publicationIntent: "draft",
      disposition: GLW_SYNTHETIC_CALLBACK_DISPOSITION,
      wordpressObjectId: null,
      wordpressUrl: null,
      wordpressStatus: null,
    });
    expect((readback as GlwPageExecutionRecord).qaChecks).toMatchObject({
      syntheticCallbackSeed: {
        ownerApprovalId: "OWNER_APPROVAL-GLW-PHASE4D-TEST-001",
        stagingOnly: true,
        nonCustomer: true,
        retentionPolicy: "RETAIN_UNTIL_OWNER_CLEANUP",
      },
    });
  });

  test("rejects duplicate creation for the same owner approval and preserves the existing record", async () => {
    const repository = createInMemoryGlwPageExecutionRepository();
    const first = await seedRecord({ repository, ownerApprovalId: "OWNER_APPROVAL-GLW-PHASE4D-TEST-002" });

    await expect(seedRecord({
      repository,
      ownerApprovalId: "OWNER_APPROVAL-GLW-PHASE4D-TEST-002",
      executionId: "synthetic-execution-002b",
    })).rejects.toThrow(/already exists/i);

    const readback = await repository.getById(first.jobId);
    expect(readback?.externalExecutionId).toBe("synthetic-execution-001");
  });

  test("enforces staging-only execution and owner approval identifier format", async () => {
    const repository = createInMemoryGlwPageExecutionRepository();
    await expect(createSyntheticGlwCallbackSeed({
      ownerApprovalId: "OWNER_APPROVAL-GLW-PHASE4D-TEST-003",
      executionId: "synthetic-execution-003",
      repository,
      environment: { GENESIS_ENVIRONMENT: "production" },
    })).rejects.toThrow(/GENESIS_ENVIRONMENT=staging/i);

    await expect(createSyntheticGlwCallbackSeed({
      ownerApprovalId: "PHASE4D-TEST-003",
      executionId: "synthetic-execution-003",
      repository,
      environment: { GENESIS_ENVIRONMENT: "staging" },
    })).rejects.toThrow(/OWNER_APPROVAL-/i);
  });

  test("uses only repository persistence calls and performs no dispatch/update side effects", async () => {
    const wrapped = wrapRepository(createInMemoryGlwPageExecutionRepository());
    await seedRecord({ repository: wrapped.repository, ownerApprovalId: "OWNER_APPROVAL-GLW-PHASE4D-TEST-004" });

    expect(wrapped.counts.create).toBe(1);
    expect(wrapped.counts.getById).toBe(1);
    expect(wrapped.counts.list).toBe(1);
    expect(wrapped.counts.update).toBe(0);
  });

  test("is compatible with reconnect callback application and replay protections", async () => {
    const repository = createInMemoryGlwPageExecutionRepository();
    const seeded = await seedRecord({
      repository,
      ownerApprovalId: "OWNER_APPROVAL-GLW-PHASE4D-TEST-005",
      executionId: "synthetic-execution-005",
    });

    const running = await applyGlwN8nReconnectCallback({
      authorizationHeader: AUTH_HEADER,
      payload: {
        jobId: seeded.jobId,
        executionId: "synthetic-execution-005",
        status: "RUNNING",
        organizationId: GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
        siteId: GLW_SYNTHETIC_CALLBACK_SITE_ID,
      },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(running).toMatchObject({ ok: true, code: "CALLBACK_APPLIED", status: 200 });

    const replay = await applyGlwN8nReconnectCallback({
      authorizationHeader: AUTH_HEADER,
      payload: {
        jobId: seeded.jobId,
        executionId: "synthetic-execution-005",
        status: "RUNNING",
      },
      repository,
      environment: reconnectEnvironment(),
    });
    expect(replay).toMatchObject({ ok: true, code: "IDEMPOTENT_REPLAY", status: 200 });
  });
});
