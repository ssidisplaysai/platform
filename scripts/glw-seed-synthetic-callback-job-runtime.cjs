const { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const PERSISTENCE_NAMESPACE = "glw-page-execution-repository";
const PERSISTENCE_SCHEMA_VERSION = 1;
const DEFAULT_PERSISTENCE_DIR = ".gcp-foundation-data";
const LOCK_RETRY_LIMIT = 2000;
const LOCK_RETRY_DELAY_MS = 5;
const STALE_LOCK_AGE_MS = 30000;
const LOCK_WAIT_BUFFER = new Int32Array(new SharedArrayBuffer(4));

const GLW_SYNTHETIC_CALLBACK_SEED_ENV = "GENESIS_ENVIRONMENT";
const GLW_SYNTHETIC_CALLBACK_OWNER_APPROVAL_PREFIX = "OWNER_APPROVAL-";
const GLW_SYNTHETIC_CALLBACK_JOB_PREFIX = "glw-synthetic-callback";
const GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID = "led-display-warehouse";
const GLW_SYNTHETIC_CALLBACK_SITE_ID = "site-led-display-warehouse-production";
const GLW_SYNTHETIC_CALLBACK_PRODUCT_ID = "prod-indoor-led-video-wall";
const GLW_SYNTHETIC_CALLBACK_DISPOSITION = "SYNTHETIC_CALLBACK_TEST_ONLY";
const REQUIRED_CONFIRM = "SEED-SYNTHETIC-CALLBACK-JOB";

function usage() {
  return "Usage: node runtime-tools/glw-seed-synthetic-callback-job-runtime.cjs --owner-approval-id OWNER_APPROVAL-... --execution-id synthetic-execution-... --confirm SEED-SYNTHETIC-CALLBACK-JOB";
}

function nowIso() {
  return new Date().toISOString();
}

function deepClone(value) {
  return structuredClone(value);
}

function resolvePersistenceRoot() {
  const fromEnv = (process.env.GCP_FOUNDATION_PERSISTENCE_DIR ?? "").trim();
  if (fromEnv) return fromEnv;
  const fromSessionEnv = (process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR ?? "").trim();
  if (fromSessionEnv) return fromSessionEnv;
  return join(process.cwd(), DEFAULT_PERSISTENCE_DIR);
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: true });
}

function namespaceFile(namespace) {
  return join(resolvePersistenceRoot(), `${namespace}.json`);
}

function withPersistenceLock(filePath, operation) {
  const lockPath = `${filePath}.lock`;
  ensureDirectory(dirname(filePath));
  for (let attempt = 0; attempt < LOCK_RETRY_LIMIT; attempt += 1) {
    let lockHandle = null;
    try {
      lockHandle = openSync(lockPath, "wx");
      writeFileSync(lockHandle, JSON.stringify({ processId: process.pid, acquiredAt: nowIso() }), "utf-8");
      try {
        return operation();
      } finally {
        closeSync(lockHandle);
        lockHandle = null;
        if (existsSync(lockPath)) unlinkSync(lockPath);
      }
    } catch (error) {
      if (lockHandle !== null) closeSync(lockHandle);
      if (error.code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > STALE_LOCK_AGE_MS) {
          unlinkSync(lockPath);
        }
      } catch {
        // Lock changed between checks.
      }
      Atomics.wait(LOCK_WAIT_BUFFER, 0, 0, LOCK_RETRY_DELAY_MS);
    }
  }
  throw new Error(`Timed out acquiring persistence lock for ${filePath}.`);
}

function readEnvelopeFromDisk(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error(`Persistence envelope for ${filePath} is malformed.`);
  if (parsed.schemaVersion !== PERSISTENCE_SCHEMA_VERSION) {
    throw new Error(`Unsupported persistence schema version ${String(parsed.schemaVersion)} for ${filePath}.`);
  }
  if (typeof parsed.revision !== "number" || typeof parsed.updatedAt !== "string" || !Object.prototype.hasOwnProperty.call(parsed, "data")) {
    throw new Error(`Persistence envelope for ${filePath} is malformed.`);
  }
  return parsed;
}

function loadState() {
  const filePath = namespaceFile(PERSISTENCE_NAMESPACE);
  const envelope = readEnvelopeFromDisk(filePath);
  if (!envelope) {
    return { filePath, revision: 0, state: { records: [] } };
  }
  return { filePath, revision: envelope.revision, state: deepClone(envelope.data) };
}

function saveState(filePath, expectedRevision, state) {
  return withPersistenceLock(filePath, () => {
    const current = readEnvelopeFromDisk(filePath);
    const currentRevision = current ? current.revision : 0;
    if (!current && expectedRevision !== 0) {
      throw new Error(`Revision conflict for ${PERSISTENCE_NAMESPACE}: expected ${expectedRevision}, found missing state.`);
    }
    if (currentRevision !== expectedRevision) {
      throw new Error(`Revision conflict for ${PERSISTENCE_NAMESPACE}: expected ${expectedRevision}, found ${currentRevision}.`);
    }

    const nextRevision = currentRevision + 1;
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    ensureDirectory(dirname(filePath));
    writeFileSync(tempPath, JSON.stringify({
      schemaVersion: PERSISTENCE_SCHEMA_VERSION,
      revision: nextRevision,
      updatedAt: nowIso(),
      data: deepClone(state),
    }, null, 2), "utf-8");
    if (existsSync(filePath)) unlinkSync(filePath);
    renameSync(tempPath, filePath);
    return nextRevision;
  });
}

function parseOptions(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    return null;
  }
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) continue;
    args.set(entry, next);
    index += 1;
  }

  const ownerApprovalId = (args.get("--owner-approval-id") ?? "").trim();
  const executionId = (args.get("--execution-id") ?? "").trim();
  const confirm = (args.get("--confirm") ?? "").trim();
  if (!ownerApprovalId || !executionId || !confirm) throw new Error(usage());
  return { ownerApprovalId, executionId, confirm };
}

function validate(input) {
  if ((process.env[GLW_SYNTHETIC_CALLBACK_SEED_ENV] ?? "").trim() !== "staging") {
    throw new Error("Synthetic callback seeding is allowed only when GENESIS_ENVIRONMENT=staging.");
  }
  if (input.confirm !== REQUIRED_CONFIRM) {
    throw new Error(`--confirm must exactly equal ${REQUIRED_CONFIRM}`);
  }
  if (!input.ownerApprovalId.startsWith(GLW_SYNTHETIC_CALLBACK_OWNER_APPROVAL_PREFIX)) {
    throw new Error(`ownerApprovalId must start with ${GLW_SYNTHETIC_CALLBACK_OWNER_APPROVAL_PREFIX}`);
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(input.ownerApprovalId)) {
    throw new Error("ownerApprovalId contains unsupported characters.");
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(input.executionId)) {
    throw new Error("executionId contains unsupported characters.");
  }
}

function buildSyntheticJob(ownerApprovalId, executionId, timestamp) {
  const normalizedApproval = ownerApprovalId.toLowerCase();
  const jobId = `${GLW_SYNTHETIC_CALLBACK_JOB_PREFIX}-${normalizedApproval}`;
  return {
    jobId,
    correlationId: jobId,
    executionTransport: "N8N_MCP",
    organizationId: GLW_SYNTHETIC_CALLBACK_ORGANIZATION_ID,
    siteId: GLW_SYNTHETIC_CALLBACK_SITE_ID,
    productId: GLW_SYNTHETIC_CALLBACK_PRODUCT_ID,
    productTopic: "Synthetic callback reconciliation validation",
    state: "TEST_ONLY",
    city: "NON_CUSTOMER",
    slug: `synthetic-callback/${normalizedApproval}`,
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
        namespace: `staging.synthetic.callback.${normalizedApproval}`,
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
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (!options) {
    console.log(usage());
    return;
  }
  validate(options);

  const loaded = loadState();
  const records = Array.isArray(loaded.state.records) ? loaded.state.records : [];
  const job = buildSyntheticJob(options.ownerApprovalId, options.executionId, nowIso());

  if (records.some((record) => record.jobId === job.jobId)) {
    throw new Error(`Synthetic callback seed already exists for jobId ${job.jobId}.`);
  }
  if (records.some((record) => record?.qaChecks?.syntheticCallbackSeed?.ownerApprovalId === options.ownerApprovalId)) {
    throw new Error(`Synthetic callback seed already exists for owner approval ${options.ownerApprovalId}.`);
  }

  const nextState = { records: [...records, job] };
  saveState(loaded.filePath, loaded.revision, nextState);

  console.log(JSON.stringify({
    ok: true,
    jobId: job.jobId,
    organizationId: job.organizationId,
    siteId: job.siteId,
    executionId: job.externalExecutionId,
    status: job.status,
    disposition: job.disposition,
    qaStatus: job.qaStatus,
    retentionPolicy: job.qaChecks.syntheticCallbackSeed.retentionPolicy,
  }, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "unknown synthetic seed failure";
  console.error(`GLW_SYNTHETIC_CALLBACK_SEED=FAIL reason=${message}`);
  process.exitCode = 1;
});
