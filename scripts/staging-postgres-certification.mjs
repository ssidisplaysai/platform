import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";
import { FOUNDATION_STATE_COLLECTIONS } from "./foundation-state-envelope.mjs";
import { postgresClientConfig } from "./postgres-connection.mjs";
import { validateRdsCaCertificate } from "./postgres-ca-preflight.mjs";
import { diagnosePostgresSchemaReadOnly } from "./postgres-schema-diagnostic.mjs";
import { verifyFoundationSchema } from "./postgres-schema-verifier.mjs";
import { formatChildFailureOutput } from "./postgres-child-output.mjs";
import { inventoryFoundationRows } from "./postgres-adapter-diagnostic.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedHost = "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com";
const expectedDatabase = "genesis_staging";
const expectedAppUser = "genesis_app";
const expectedAdminUser = "genesis_admin";
const expectedSource = "/mnt/genesis-persistence/foundation/share-to-grow-repository.json";
const namespace = "share-to-grow-repository";
let currentStep = "preflight";

function fail(message) {
  throw new Error(message);
}

function safeConfig(environment = process.env) {
  const config = postgresClientConfig(environment);
  if (
    config.host.toLowerCase() !== expectedHost
    || config.port !== 5432
    || config.database !== expectedDatabase
    || /prod/i.test(config.host)
    || /prod/i.test(config.database)
  ) {
    fail("database target differs from the approved staging PostgreSQL target");
  }
  return config;
}

function isStagingPrivateAddress(address) {
  if (isIP(address) !== 4) return false;
  const octets = address.split(".").map(Number);
  return octets[0] === 10 && octets[1] === 42;
}

async function verifyEndpoint() {
  const answers = await lookup(expectedHost, { all: true, verbatim: true });
  if (answers.length === 0 || answers.some(({ address }) => !isStagingPrivateAddress(address))) {
    fail("database endpoint did not resolve exclusively to the approved private staging address range");
  }
}

async function verifyEfsSource(sourcePath) {
  if (sourcePath !== expectedSource) fail("EFS source path differs from the approved foundation state file");
  const mountPath = "/mnt/genesis-persistence";
  const mounts = (await readFile("/proc/mounts", "utf8")).split("\n");
  const mount = mounts
    .map((line) => line.split(" "))
    .find((parts) => parts[1] === mountPath && parts[2] === "nfs4");
  if (!mount || !mount[3].split(",").includes("ro")) {
    fail("existing staging EFS source is not mounted read-only");
  }

  const sourceInfo = await lstat(sourcePath);
  if (!sourceInfo.isFile() || sourceInfo.isSymbolicLink()) {
    fail("EFS foundation source is not a regular file");
  }
  const resolvedPath = await realpath(sourcePath);
  if (resolvedPath !== sourcePath) fail("EFS foundation source resolves outside its approved path");
  const raw = await readFile(sourcePath);
  let envelope;
  try {
    envelope = JSON.parse(raw.toString("utf8"));
  } catch {
    fail("EFS foundation source is not valid JSON");
  }
  const counts = Object.fromEntries(FOUNDATION_STATE_COLLECTIONS.map((key) => [
    key,
    Array.isArray(envelope?.data?.[key]) ? envelope.data[key].length : 0,
  ]));
  const idFields = {
    participants: "participantId",
    trackingIdentities: "trackingIdentityId",
    ruleVersions: "id",
    ledgerEntries: "id",
    sourceEventReceipts: "sourceEventId",
    processedCommerceLines: "lineKey",
    payoutEntitlements: "entitlementId",
    commerceAdjustments: "adjustmentId",
  };
  const ids = Object.fromEntries(FOUNDATION_STATE_COLLECTIONS.map((collection) => {
    const identifiers = (envelope?.data?.[collection] ?? [])
      .map((record) => record?.[idFields[collection]])
      .filter((value) => typeof value === "string")
      .sort();
    return [collection, createHash("sha256").update(JSON.stringify(identifiers)).digest("hex")];
  }));
  return {
    raw,
    envelope,
    counts,
    ids,
    sha256: createHash("sha256").update(raw).digest("hex"),
  };
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

function quoteLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

async function provisionApplicationRole(config) {
  const username = process.env.DB_USERNAME?.trim();
  const password = process.env.DB_PASSWORD;
  const adminUsername = process.env.DB_ADMIN_USERNAME?.trim();
  const adminPassword = process.env.DB_ADMIN_PASSWORD;
  if (
    username !== expectedAppUser
    || adminUsername !== expectedAdminUser
    || !password
    || !adminPassword
  ) {
    fail("staging application or RDS master credential metadata is invalid");
  }

  const admin = new Client({
    ...config,
    user: adminUsername,
    password: adminPassword,
    application_name: "genesis-staging-postgres-certification-bootstrap",
  });
  try {
    await admin.connect();
    const identity = await admin.query("SELECT current_database() AS database, current_user AS username");
    if (identity.rows[0]?.database !== expectedDatabase || identity.rows[0]?.username !== expectedAdminUser) {
      fail("RDS master connection identity does not match the approved staging target");
    }
    const role = quoteIdentifier(username);
    const rolePassword = quoteLiteral(password);
    const exists = await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [username]);
    if (exists.rowCount === 0) {
      await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD ${rolePassword}`);
    } else {
      const app = new Client({
        ...config,
        user: username,
        password,
        application_name: "genesis-staging-postgres-certification-app-credential-check",
      });
      try {
        await app.connect();
        const appIdentity = await app.query("SELECT current_database() AS database, current_user AS username");
        if (appIdentity.rows[0]?.database !== expectedDatabase || appIdentity.rows[0]?.username !== username) {
          fail("existing staging application database role does not match the approved target");
        }
      } finally {
        await app.end();
      }
    }
    const privileges = await admin.query(
      `SELECT
         has_database_privilege($1, $2, 'CONNECT') AS can_connect,
         has_schema_privilege($1, 'public', 'USAGE') AS can_use_schema,
         has_schema_privilege($1, 'public', 'CREATE') AS can_create_schema`,
      [username, expectedDatabase],
    );
    if (!privileges.rows[0]?.can_connect) {
      await admin.query(`GRANT CONNECT ON DATABASE ${quoteIdentifier(expectedDatabase)} TO ${role}`);
    }
    if (!privileges.rows[0]?.can_use_schema) {
      await admin.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
    }
    if (!privileges.rows[0]?.can_create_schema) {
      await admin.query(`GRANT CREATE ON SCHEMA public TO ${role}`);
    }
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code
      : "UNKNOWN";
    console.error(`STAGING_APPLICATION_ROLE_BOOTSTRAP=FAIL database_error_code=${code}`);
    fail("staging application database role could not be safely provisioned");
  } finally {
    await admin.end();
  }
}

function runRepositoryCommand(label, executable, args, environment, expectedError) {
  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    env: environment,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (expectedError) {
    if (
      result.status !== 0
      && !result.error
      && result.stderr.includes(expectedError)
    ) {
      console.log(`${label}=SAFELY_REJECTED`);
      return result;
    }
    fail(`${label} did not produce the expected safe refusal`);
  }
  if (result.error || result.status !== 0) {
    const code = result.error?.code ?? `EXIT_${result.status}`;
    console.error(formatChildFailureOutput(label, result, environment));
    fail(`${label} failed (${code})`);
  }
  return result;
}

const liveTestFile = "src/modules/foundation/__tests__/postgres-foundation-state-store.live.test.ts";

function runLiveAdapterTest(label, testNamePattern) {
  const testEnvironment = applicationEnvironment();
  testEnvironment.POSTGRES_LIVE_CERTIFICATION = "1";
  runRepositoryCommand(
    label,
    process.execPath,
    [
      "node_modules/jest/bin/jest.js",
      "--runInBand",
      "--cacheDirectory=/tmp/jest-cache",
      liveTestFile,
      "-t",
      testNamePattern,
    ],
    testEnvironment,
  );
  console.log(`${label}=PASS`);
}

function runLiveAdapterTests() {
  runLiveAdapterTest("POSTGRES_LIVE_INTEGRATION", "POSTGRES_LIVE_INTEGRATION");
  runLiveAdapterTest("POSTGRES_CONCURRENCY_CERTIFICATION", "POSTGRES_CONCURRENCY_CERTIFICATION");
}

async function logFoundationRowInventory(config, phase) {
  const pool = new Pool({ ...config, max: 1, application_name: "genesis-staging-postgres-adapter-diagnostic-inventory" });
  try {
    const rows = await inventoryFoundationRows(pool);
    console.log(`POSTGRES_FOUNDATION_ROWS_${phase}=${JSON.stringify(rows)}`);
    return rows;
  } finally {
    await pool.end();
  }
}

async function diagnoseAdapter(config) {
  currentStep = "private endpoint";
  await verifyEndpoint();
  console.log("DATABASE_ENDPOINT_PRIVATE=PASS");

  currentStep = "database connection";
  const identityPool = new Pool({ ...config, max: 1, application_name: "genesis-staging-postgres-adapter-diagnostic-identity" });
  try {
    const identity = await identityPool.query("SELECT current_database() AS database, current_user AS username");
    if (identity.rows[0]?.database !== expectedDatabase || identity.rows[0]?.username !== expectedAppUser) {
      fail("application database connection identity does not match the approved staging target");
    }
  } finally {
    await identityPool.end();
  }
  console.log("DATABASE_CONNECTION=PASS");

  currentStep = "foundation row inventory before";
  await logFoundationRowInventory(config, "BEFORE");

  currentStep = "live adapter integration test";
  runLiveAdapterTest("POSTGRES_LIVE_INTEGRATION", "POSTGRES_LIVE_INTEGRATION");
  currentStep = "live adapter concurrency test";
  runLiveAdapterTest("POSTGRES_CONCURRENCY_CERTIFICATION", "POSTGRES_CONCURRENCY_CERTIFICATION");

  currentStep = "foundation row inventory after";
  await logFoundationRowInventory(config, "AFTER");
}

function applicationEnvironment() {
  const environment = {
    ...process.env,
    GENESIS_ENVIRONMENT: "staging",
    GENESIS_STAGING_DATABASE_HOST: expectedHost,
    GENESIS_STAGING_DATABASE_NAME: expectedDatabase,
  };
  delete environment.DB_ADMIN_USERNAME;
  delete environment.DB_ADMIN_PASSWORD;
  delete environment.GENESIS_STATE_BACKEND;
  return environment;
}

async function verifySchema(config) {
  const pool = new Pool({ ...config, max: 1, application_name: "genesis-staging-postgres-certification-schema" });
  try {
    await verifyFoundationSchema(pool, expectedDatabase, expectedAppUser);
    console.log("POSTGRES_SCHEMA=PASS columns=5 primary_key=namespace indexes=1 constraints=3 migration=recorded");
  } finally {
    await pool.end();
  }
}

async function diagnoseSchema(config) {
  const pool = new Pool({
    ...config,
    max: 1,
    application_name: "genesis-staging-postgres-schema-diagnostic",
  });
  try {
    const diagnostic = await diagnosePostgresSchemaReadOnly(pool);
    console.log(`POSTGRES_SCHEMA_DIAGNOSTIC=${JSON.stringify(diagnostic.metadata)}`);
    console.log(`POSTGRES_SCHEMA_VERIFIER_PROJECTION=${JSON.stringify(diagnostic.verifierProjection)}`);
    console.log(`POSTGRES_SCHEMA_MISMATCHES=${JSON.stringify(diagnostic.mismatches)}`);
  } finally {
    await pool.end();
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function verifyImport(config, sourceEnvelope, expectedRowCount) {
  const pool = new Pool({ ...config, max: 1, application_name: "genesis-staging-postgres-certification-import-verify" });
  try {
    const count = await pool.query("SELECT count(*)::integer AS count FROM public.genesis_foundation_state");
    if (count.rows[0]?.count !== expectedRowCount) {
      fail("foundation state row count differs from the expected migration/import count");
    }
    const result = await pool.query(
      `SELECT schema_version, revision, updated_at, data, data = $2::jsonb AS equal
       FROM public.genesis_foundation_state
       WHERE namespace = $1`,
      [namespace, JSON.stringify(sourceEnvelope.data)],
    );
    if (
      result.rowCount !== 1
      || result.rows[0].schema_version !== sourceEnvelope.schemaVersion
      || Number(result.rows[0].revision) !== sourceEnvelope.revision
      || new Date(result.rows[0].updated_at).getTime() !== new Date(sourceEnvelope.updatedAt).getTime()
      || result.rows[0].equal !== true
      || canonicalJson(result.rows[0].data) !== canonicalJson(sourceEnvelope.data)
    ) {
      fail("PostgreSQL target does not exactly match the validated EFS source envelope");
    }
    console.log(`POSTGRES_IMPORT_PARITY=PASS rows=${count.rows[0].count} source_revision=${sourceEnvelope.revision}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  if (process.env.GENESIS_ENVIRONMENT !== "staging") fail("certification requires GENESIS_ENVIRONMENT=staging");
  if (process.env.GENESIS_STATE_BACKEND) fail("certification must not select or change the application runtime backend");

  currentStep = "RDS CA certificate preflight";
  validateRdsCaCertificate(process.env);
  console.log("RDS_CA_CERTIFICATE=READY");

  if (process.argv[2] === "--diagnose-adapter") {
    const config = safeConfig();
    if (config.user !== expectedAppUser) fail("adapter diagnostic requires the approved application database role");
    await diagnoseAdapter(config);
    console.log("POSTGRES_ADAPTER_DIAGNOSTIC=PASS");
    return;
  }

  if (process.argv[2] === "--diagnose-schema") {
    const diagnosticUsername = process.env.DB_ADMIN_USERNAME?.trim();
    const diagnosticPassword = process.env.DB_ADMIN_PASSWORD;
    if (diagnosticUsername !== expectedAdminUser || !diagnosticPassword) {
      fail("read-only schema diagnostic requires the approved RDS master credential");
    }
    const config = safeConfig({
      ...process.env,
      DB_USERNAME: diagnosticUsername,
      DB_PASSWORD: diagnosticPassword,
    });
    currentStep = "private endpoint";
    await verifyEndpoint();
    console.log("DATABASE_ENDPOINT_PRIVATE=PASS");
    currentStep = "read-only schema diagnostic";
    await diagnoseSchema(config);
    console.log("POSTGRES_SCHEMA_DIAGNOSTIC=PASS");
    return;
  }

  const sourcePath = process.env.POSTGRES_CERTIFICATION_SOURCE;
  if (sourcePath !== expectedSource) fail("certification source path differs from the approved EFS foundation path");
  const config = safeConfig();

  currentStep = "private endpoint";
  await verifyEndpoint();
  console.log("DATABASE_ENDPOINT_PRIVATE=PASS");

  currentStep = "EFS inventory";
  const source = await verifyEfsSource(sourcePath);
  console.log(`EFS_INVENTORY=PASS bytes=${source.raw.length} sha256=${source.sha256} counts=${JSON.stringify(source.counts)} id_sha256=${JSON.stringify(source.ids)}`);

  currentStep = "application role bootstrap";
  await provisionApplicationRole(config);
  console.log("STAGING_APPLICATION_ROLE=READY");

  currentStep = "database connection";
  const identityPool = new Pool({ ...config, max: 1, application_name: "genesis-staging-postgres-certification-identity" });
  try {
    const identity = await identityPool.query("SELECT current_database() AS database, current_user AS username");
    if (identity.rows[0]?.database !== expectedDatabase || identity.rows[0]?.username !== expectedAppUser) {
      fail("application database connection identity does not match the approved staging target");
    }
  } finally {
    await identityPool.end();
  }
  console.log("DATABASE_CONNECTION=PASS");

  currentStep = "migration";
  runRepositoryCommand(
    "FOUNDATION_MIGRATION",
    process.execPath,
    ["scripts/migrate-foundation-state.mjs", "up"],
    applicationEnvironment(),
  );
  console.log("FOUNDATION_MIGRATION=PASS");

  currentStep = "schema verification";
  await verifySchema(config);

  currentStep = "real adapter integration and concurrency tests";
  runLiveAdapterTests();
  console.log("POSTGRES_ADAPTER_CERTIFICATION=PASS");

  currentStep = "import dry run";
  const beforeCountPool = new Pool({ ...config, max: 1, application_name: "genesis-staging-postgres-certification-count" });
  let beforeCount;
  try {
    const result = await beforeCountPool.query("SELECT count(*)::integer AS count FROM public.genesis_foundation_state");
    beforeCount = result.rows[0].count;
  } finally {
    await beforeCountPool.end();
  }
  runRepositoryCommand(
    "FOUNDATION_IMPORT_DRY_RUN",
    process.execPath,
    ["scripts/import-foundation-state.mjs", "--source", sourcePath, "--namespace", namespace, "--dry-run"],
    applicationEnvironment(),
  );
  console.log("FOUNDATION_IMPORT_DRY_RUN=PASS");

  currentStep = "foundation state import";
  runRepositoryCommand(
    "FOUNDATION_IMPORT",
    process.execPath,
    ["scripts/import-foundation-state.mjs", "--source", sourcePath, "--namespace", namespace, "--confirm-staging-target"],
    applicationEnvironment(),
  );
  await verifyImport(config, source.envelope, beforeCount + 1);
  const sourceAfterImport = await readFile(sourcePath);
  if (createHash("sha256").update(sourceAfterImport).digest("hex") !== source.sha256) {
    fail("read-only EFS source checksum changed during certification");
  }
  console.log("EFS_SOURCE_UNCHANGED=PASS");

  currentStep = "import replay safety";
  const replay = spawnSync(process.execPath, [
    "scripts/import-foundation-state.mjs",
    "--source",
    sourcePath,
    "--namespace",
    namespace,
    "--confirm-staging-target",
  ], {
    cwd: repoRoot,
    env: applicationEnvironment(),
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 8 * 1024 * 1024,
    windowsHide: true,
  });
  if (
    replay.error
    || replay.status === 0
    || !replay.stderr.includes(`Destination namespace ${namespace} is not empty; refusing overwrite.`)
  ) {
    fail("import replay was not safely rejected by the populated-destination guard");
  }
  console.log("FOUNDATION_IMPORT_REPLAY=SAFELY_REJECTED");
  await verifyImport(config, source.envelope, beforeCount + 1);
  console.log("STAGING_POSTGRES_CERTIFICATION=PASS");
}

main().catch((error) => {
  const code = error && typeof error.message === "string" ? error.message : "unexpected failure";
  console.error(`STAGING_POSTGRES_CERTIFICATION=FAIL step=${currentStep} reason=${code}`);
  process.exitCode = 1;
});
