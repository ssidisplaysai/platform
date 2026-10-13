import { randomBytes, createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { lookup } from "node:dns/promises";
import { dirname, resolve } from "node:path";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { postgresClientConfig } from "./postgres-connection.mjs";
import { validateRdsCaCertificate } from "./postgres-ca-preflight.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedHost = "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com";
const expectedDatabase = "genesis_staging";
const expectedEnvironment = "staging";
const expectedAdminUser = "genesis_admin";
const snapshotReaderRole = "genesis_share_to_grow_snapshot_reader";
const namespace = "share-to-grow-repository";
const provisioningApprovalToken = "APPROVED_PHASE_A_DB_ROLE_PROVISIONING";

function fail(message) {
  throw new Error(message);
}

function isPrivateStagingAddress(address) {
  if (isIP(address) !== 4) return false;
  const [o1, o2] = address.split(".").map(Number);
  return o1 === 10 && o2 === 42;
}

async function verifyPrivateEndpoint(hostname, dnsLookup = lookup) {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  if (results.length === 0 || results.some(({ address }) => !isPrivateStagingAddress(address))) {
    fail("STAGING_PRIVATE_ENDPOINT_REQUIRED");
  }
}

function buildAdminConfig(environment = process.env) {
  if ((environment.GENESIS_ENVIRONMENT ?? "").trim() !== expectedEnvironment) {
    fail("GENESIS_ENVIRONMENT_STAGING_REQUIRED");
  }
  if ((environment.GENESIS_STATE_BACKEND ?? "").trim()) {
    fail("GENESIS_STATE_BACKEND_MUST_BE_UNSET");
  }
  if ((environment.DB_HOST ?? "").trim().toLowerCase() !== expectedHost) {
    fail("STAGING_DB_HOST_MISMATCH");
  }
  if ((environment.DB_NAME ?? "").trim() !== expectedDatabase) {
    fail("STAGING_DB_NAME_MISMATCH");
  }
  if ((environment.DB_PORT ?? "").trim() !== "5432") {
    fail("STAGING_DB_PORT_MISMATCH");
  }

  const adminUsername = environment.DB_ADMIN_USERNAME?.trim();
  const adminPassword = environment.DB_ADMIN_PASSWORD;
  if (adminUsername !== expectedAdminUser || !adminPassword) {
    fail("STAGING_ADMIN_CREDENTIAL_REQUIRED");
  }
  validateRdsCaCertificate(environment);

  return postgresClientConfig({
    ...environment,
    DB_USERNAME: adminUsername,
    DB_PASSWORD: adminPassword,
  });
}

function normalizeArgv(argv) {
  if (argv.some((token) => token === "--sql" || token.startsWith("--sql="))) {
    fail("ARBITRARY_SQL_INPUT_REJECTED");
  }
  if (argv.length === 0) {
    fail("USAGE: --diagnose-admin-readonly | --prepare-provisioning-sql | --generate-reader-credential-handoff --output-file <abs-path>");
  }
  return argv;
}

function reviewedProvisioningSql() {
  const quotedRole = `"${snapshotReaderRole}"`;
  return [
    "BEGIN;",
    `CREATE ROLE ${quotedRole} LOGIN PASSWORD :'snapshot_reader_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;`,
    `REVOKE ALL ON DATABASE "${expectedDatabase}" FROM ${quotedRole};`,
    `GRANT CONNECT ON DATABASE "${expectedDatabase}" TO ${quotedRole};`,
    `REVOKE ALL ON SCHEMA public FROM ${quotedRole};`,
    `GRANT USAGE ON SCHEMA public TO ${quotedRole};`,
    `REVOKE CREATE ON SCHEMA public FROM ${quotedRole};`,
    `REVOKE ALL ON TABLE public.genesis_foundation_state FROM ${quotedRole};`,
    `GRANT SELECT ON TABLE public.genesis_foundation_state TO ${quotedRole};`,
    "COMMIT;",
  ];
}

export async function runAdminReadOnlyDiagnostic(environment = process.env, dependencies = {}) {
  const config = buildAdminConfig(environment);
  await verifyPrivateEndpoint(config.host, dependencies.dnsLookup ?? lookup);
  const client = dependencies.createClient ? dependencies.createClient(config) : new Client(config);
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const tx = await client.query("SELECT current_setting('transaction_read_only') AS tx");
    if (tx.rows[0]?.tx !== "on") fail("READ_ONLY_TRANSACTION_REQUIRED");

    const identity = await client.query("SELECT current_database() AS database, current_user AS username");
    if (identity.rows[0]?.database !== expectedDatabase || identity.rows[0]?.username !== expectedAdminUser) {
      fail("ADMIN_IDENTITY_MISMATCH");
    }

    const adminCapabilities = await client.query(
      `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
       FROM pg_roles WHERE rolname = current_user`,
    );
    const targetRole = await client.query(
      `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolinherit
       FROM pg_roles WHERE rolname = $1`,
      [snapshotReaderRole],
    );
    const roleMembership = await client.query(
      `SELECT pg_get_userbyid(roleid) AS granted_role
       FROM pg_auth_members
       WHERE pg_get_userbyid(member) = $1
       ORDER BY granted_role`,
      [snapshotReaderRole],
    );
    const grants = await client.query(
      `SELECT
         has_database_privilege($1, $2, 'CONNECT') AS can_connect,
         has_schema_privilege($1, 'public', 'USAGE') AS can_use_schema,
         has_schema_privilege($1, 'public', 'CREATE') AS can_create_schema,
         has_table_privilege($1, 'public.genesis_foundation_state', 'SELECT') AS can_select_table,
         has_table_privilege($1, 'public.genesis_foundation_state', 'INSERT') AS can_insert_table,
         has_table_privilege($1, 'public.genesis_foundation_state', 'UPDATE') AS can_update_table,
         has_table_privilege($1, 'public.genesis_foundation_state', 'DELETE') AS can_delete_table,
         has_table_privilege($1, 'public.genesis_foundation_state', 'TRUNCATE') AS can_truncate_table`,
      [snapshotReaderRole, expectedDatabase],
    );
    const publicTableGrants = await client.query(
      `SELECT privilege_type
       FROM information_schema.table_privileges
       WHERE table_schema='public'
         AND table_name='genesis_foundation_state'
         AND grantee='PUBLIC'
       ORDER BY privilege_type`,
    );
    const tableOwner = await client.query(
      `SELECT pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname='public' AND c.relname='genesis_foundation_state'`,
    );
    const defaultPrivileges = await client.query(
      `SELECT pg_get_userbyid(defaclrole) AS owner,
              defaclobjtype AS object_type,
              coalesce(array_to_string(defaclacl, ','), '') AS acl
       FROM pg_default_acl
       ORDER BY owner, object_type`,
    );
    const businessNamespace = await client.query(
      `SELECT namespace, schema_version, revision::text AS revision, updated_at, md5(data::text) AS data_md5
       FROM public.genesis_foundation_state
       WHERE namespace = $1`,
      [namespace],
    );

    return {
      mode: "DIAGNOSTIC_ONLY",
      host: config.host,
      database: expectedDatabase,
      adminIdentity: identity.rows[0],
      adminCapabilities: adminCapabilities.rows[0] ?? null,
      targetRoleExists: targetRole.rowCount === 1,
      targetRole: targetRole.rows[0] ?? null,
      targetRoleMemberships: roleMembership.rows.map(({ granted_role: grantedRole }) => grantedRole),
      targetRoleEffectivePrivileges: grants.rows[0] ?? null,
      publicTableGrants: publicTableGrants.rows.map(({ privilege_type: privilegeType }) => privilegeType),
      tableOwner: tableOwner.rows[0]?.owner ?? null,
      defaultPrivileges: defaultPrivileges.rows,
      namespaceSnapshot: businessNamespace.rows[0] ?? null,
    };
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    await client.end();
  }
}

export function buildProvisioningPlan(environment = process.env) {
  const config = buildAdminConfig(environment);
  if ((environment.S2G_DB_ROLE_PROVISIONING_APPROVAL ?? "").trim() !== provisioningApprovalToken) {
    fail("PROVISIONING_AUTHORIZATION_REQUIRED");
  }
  return {
    mode: "PROVISIONING_PLAN_ONLY",
    targetHost: config.host,
    targetDatabase: expectedDatabase,
    targetRole: snapshotReaderRole,
    sql: reviewedProvisioningSql(),
    controls: {
      fixedRole: snapshotReaderRole,
      fixedTable: "public.genesis_foundation_state",
      rejectsArbitrarySqlInput: true,
      requiresIndependentAuthorizationToken: true,
    },
  };
}

export async function generateCredentialHandoff(outputFilePath, environment = process.env, write = writeFile) {
  if (!outputFilePath || !resolve(outputFilePath)) fail("CREDENTIAL_HANDOFF_OUTPUT_REQUIRED");
  const absolute = resolve(outputFilePath);
  if (absolute.startsWith(repoRoot)) fail("CREDENTIAL_HANDOFF_PATH_MUST_BE_OUTSIDE_REPOSITORY");
  await mkdir(dirname(absolute), { recursive: true });
  const password = randomBytes(48).toString("base64url");
  const payload = JSON.stringify({
    role: snapshotReaderRole,
    database: expectedDatabase,
    host: expectedHost,
    generatedAt: new Date().toISOString(),
    password,
  });
  await write(absolute, payload, { encoding: "utf8", mode: 0o600, flag: "wx" });
  return {
    outputFile: absolute,
    passwordSha256: createHash("sha256").update(password, "utf8").digest("hex"),
    forPhase: "B_SECRET_CREATION",
    note: "Password value written only to outputFile; never printed.",
    environment: environment.GENESIS_ENVIRONMENT ?? null,
  };
}

async function main(argv = process.argv.slice(2), environment = process.env) {
  const args = normalizeArgv(argv);
  const [mode] = args;
  if (mode === "--diagnose-admin-readonly") {
    const report = await runAdminReadOnlyDiagnostic(environment);
    console.log(`S2G_DB_ADMIN_DIAGNOSTIC=PASS ${JSON.stringify(report)}`);
    return;
  }
  if (mode === "--prepare-provisioning-sql") {
    const plan = buildProvisioningPlan(environment);
    console.log(`S2G_DB_ROLE_PROVISIONING_SQL_READY=PASS ${JSON.stringify(plan)}`);
    return;
  }
  if (mode === "--generate-reader-credential-handoff") {
    const outputIndex = args.indexOf("--output-file");
    const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
    if (!outputFile || args.length !== 3) fail("USAGE: --generate-reader-credential-handoff --output-file <abs-path>");
    const handoff = await generateCredentialHandoff(outputFile, environment);
    console.log(`S2G_DB_READER_CREDENTIAL_HANDOFF=PASS ${JSON.stringify(handoff)}`);
    return;
  }
  fail("UNSUPPORTED_MODE");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(`S2G_DB_ROLE_PROVISION=FAIL reason=${message}`);
    process.exitCode = 1;
  });
}
