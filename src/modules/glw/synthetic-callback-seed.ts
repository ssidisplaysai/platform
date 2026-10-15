import {
  GLW_APPLICATION_SITE_ID,
  GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID,
  type GlwPageExecutionRecord,
  type GlwPageExecutionRepository,
} from "./page-execution";

export const GLW_SYNTHETIC_CALLBACK_SEED_ENV = "GENESIS_ENVIRONMENT";
export const GLW_SYNTHETIC_CALLBACK_OWNER_APPROVAL_PREFIX = "OWNER_APPROVAL-";
export const GLW_SYNTHETIC_CALLBACK_JOB_PREFIX = "glw-synthetic-callback";
export const GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID = "led-display-warehouse";
export const GLW_SYNTHETIC_CALLBACK_SITE_ID = GLW_APPLICATION_SITE_ID;
export const GLW_SYNTHETIC_CALLBACK_PRODUCT_ID = GLW_INDOOR_LED_VIDEO_WALL_PRODUCT_ID;
export const GLW_SYNTHETIC_CALLBACK_DISPOSITION = "SYNTHETIC_CALLBACK_TEST_ONLY";

type SyntheticSeedChecks = {
  syntheticCallbackSeed?: {
    namespace: string;
    ownerApprovalId: string;
  };
};

export type CreateSyntheticCallbackSeedInput = {
  ownerApprovalId: string;
  executionId: string;
  repository: GlwPageExecutionRepository;
  environment?: NodeJS.ProcessEnv;
  now?: () => string;
};

function canonicalizeOwnerApprovalId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith(GLW_SYNTHETIC_CALLBACK_OWNER_APPROVAL_PREFIX)) {
    throw new Error(`ownerApprovalId must start with ${GLW_SYNTHETIC_CALLBACK_OWNER_APPROVAL_PREFIX}`);
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) {
    throw new Error("ownerApprovalId contains unsupported characters.");
  }
  return trimmed;
}

function normalizeExecutionId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("executionId is required.");
  if (!/^[A-Za-z0-9._:-]+$/.test(trimmed)) {
    throw new Error("executionId contains unsupported characters.");
  }
  return trimmed;
}

function requireStagingEnvironment(environment: NodeJS.ProcessEnv): void {
  if ((environment[GLW_SYNTHETIC_CALLBACK_SEED_ENV] ?? "").trim() !== "staging") {
    throw new Error("Synthetic callback seeding is allowed only when GENESIS_ENVIRONMENT=staging.");
  }
}

function buildSyntheticJobId(ownerApprovalId: string): string {
  return `${GLW_SYNTHETIC_CALLBACK_JOB_PREFIX}-${ownerApprovalId.toLowerCase()}`;
}

function testNamespace(ownerApprovalId: string): string {
  return `staging.synthetic.callback.${ownerApprovalId.toLowerCase()}`;
}

function hasMatchingOwnerApproval(record: GlwPageExecutionRecord, ownerApprovalId: string): boolean {
  const checks = record.qaChecks as SyntheticSeedChecks | null;
  return checks?.syntheticCallbackSeed?.ownerApprovalId === ownerApprovalId;
}

export async function createSyntheticGlwCallbackSeed(
  input: CreateSyntheticCallbackSeedInput,
): Promise<GlwPageExecutionRecord> {
  const environment = input.environment ?? process.env;
  requireStagingEnvironment(environment);

  const ownerApprovalId = canonicalizeOwnerApprovalId(input.ownerApprovalId);
  const executionId = normalizeExecutionId(input.executionId);
  const jobId = buildSyntheticJobId(ownerApprovalId);
  const namespace = testNamespace(ownerApprovalId);
  const timestamp = (input.now ?? (() => new Date().toISOString()))();

  const existingById = await input.repository.getById(jobId);
  if (existingById) {
    throw new Error(`Synthetic callback seed already exists for jobId ${jobId}.`);
  }

  const existingRecords = await input.repository.list();
  const existingByApproval = existingRecords.find((record) => hasMatchingOwnerApproval(record, ownerApprovalId));
  if (existingByApproval) {
    throw new Error(`Synthetic callback seed already exists for owner approval ${ownerApprovalId}.`);
  }

  return input.repository.create({
    jobId,
    correlationId: jobId,
    executionTransport: "N8N_MCP",
    organizationId: GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
    siteId: GLW_SYNTHETIC_CALLBACK_SITE_ID,
    productId: GLW_SYNTHETIC_CALLBACK_PRODUCT_ID,
    productTopic: "Synthetic callback reconciliation validation",
    state: "TEST_ONLY",
    city: "NON_CUSTOMER",
    slug: `synthetic-callback/${ownerApprovalId.toLowerCase()}`,
    title: `Synthetic callback test ${ownerApprovalId}`,
    seoTitle: `Synthetic callback test ${ownerApprovalId}`,
    metaDescription: "Synthetic staging-only callback seed for durable reconciliation validation.",
    publicationIntent: "draft",
    status: "DISPATCHED",
    externalExecutionId: executionId,
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    generatedDraft: null,
    errorCode: null,
    errorMessage: null,
    requestedPublicationMode: "draft",
    disposition: GLW_SYNTHETIC_CALLBACK_DISPOSITION,
    qaStatus: "TEST_ONLY",
    qaChecks: {
      syntheticCallbackSeed: {
        namespace,
        ownerApprovalId,
        stagingOnly: true,
        nonCustomer: true,
        retentionPolicy: "RETAIN_UNTIL_OWNER_CLEANUP",
        cleanupPolicy: "Delete only this exact synthetic jobId after owner sign-off.",
      },
    },
    qaFailureReasons: null,
    focusKeyphrase: null,
    wordCount: null,
    featuredImagePresent: null,
    createdAt: timestamp,
    dispatchedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  });
}
