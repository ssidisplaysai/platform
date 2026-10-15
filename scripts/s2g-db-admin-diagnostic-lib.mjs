import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Client } from "pg";
import { postgresClientConfig } from "./postgres-connection.mjs";
import { validateRdsCaCertificate } from "./postgres-ca-preflight.mjs";

const expectedHost = "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com";
const expectedDatabase = "genesis_staging";
const expectedEnvironment = "staging";
const expectedAdminUser = "genesis_admin";
const snapshotReaderRole = "genesis_share_to_grow_snapshot_reader";
const namespace = "share-to-grow-repository";
export const DIAGNOSTIC_MODE = "--diagnose-admin-readonly";
export const ALLOWED_FAILURE_CODES = new Set([
  "ARBITRARY_SQL_INPUT_REJECTED",
  "USAGE_DIAGNOSTIC_ONLY",
  "GENESIS_ENVIRONMENT_STAGING_REQUIRED",
  "GENESIS_STATE_BACKEND_MUST_BE_UNSET",
  "STAGING_DB_HOST_MISMATCH",
  "STAGING_DB_NAME_MISMATCH",
  "STAGING_DB_PORT_MISMATCH",
  "STAGING_ADMIN_CREDENTIAL_REQUIRED",
  "STAGING_PRIVATE_ENDPOINT_REQUIRED",
  "READ_ONLY_TRANSACTION_REQUIRED",
  "ADMIN_IDENTITY_MISMATCH",
  "DB_ADMIN_AUTH_FAILED",
  "DB_DIAGNOSTIC_QUERY_REJECTED",
]);

const QUERY_ALLOWLIST = Object.freeze({
  readOnlySetting: "SELECT current_setting('transaction_read_only') AS tx",
  identity: "SELECT current_database() AS database, current_user AS username",
  adminCapabilities: `SELECT rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls
    FROM pg_roles WHERE rolname = current_user`,
  targetRole: `SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls, rolinherit
    FROM pg_roles WHERE rolname = $1`,
  roleMembership: `SELECT pg_get_userbyid(roleid) AS granted_role
    FROM pg_auth_members
    WHERE pg_get_userbyid(member) = $1
    ORDER BY granted_role`,
  grants: `SELECT
      has_database_privilege($1, $2, 'CONNECT') AS can_connect,
      has_schema_privilege($1, 'public', 'USAGE') AS can_use_schema,
      has_schema_privilege($1, 'public', 'CREATE') AS can_create_schema,
      has_table_privilege($1, 'public.genesis_foundation_state', 'SELECT') AS can_select_table,
      has_table_privilege($1, 'public.genesis_foundation_state', 'INSERT') AS can_insert_table,
      has_table_privilege($1, 'public.genesis_foundation_state', 'UPDATE') AS can_update_table,
      has_table_privilege($1, 'public.genesis_foundation_state', 'DELETE') AS can_delete_table,
      has_table_privilege($1, 'public.genesis_foundation_state', 'TRUNCATE') AS can_truncate_table`,
  publicTableGrants: `SELECT privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema='public'
      AND table_name='genesis_foundation_state'
      AND grantee='PUBLIC'
    ORDER BY privilege_type`,
  tableOwner: `SELECT pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='genesis_foundation_state'`,
  defaultPrivileges: `SELECT pg_get_userbyid(defaclrole) AS owner,
      defaclobjtype AS object_type,
      coalesce(array_to_string(defaclacl, ','), '') AS acl
    FROM pg_default_acl
    ORDER BY owner, object_type`,
  businessNamespace: `SELECT namespace, schema_version, revision::text AS revision, updated_at, md5(data::text) AS data_md5
    FROM public.genesis_foundation_state
    WHERE namespace = $1`,
});

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function isPrivateStagingAddress(address) {
  if (isIP(address) !== 4) return false;
  const [o1, o2] = address.split(".").map(Number);
  return o1 === 10 && o2 === 42;
}

async function verifyPrivateEndpoint(hostname, dnsLookup = lookup) {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  if (results.length === 0 || results.some(({ address }) => !isPrivateStagingAddress(address))) {
    throw failure("STAGING_PRIVATE_ENDPOINT_REQUIRED");
  }
}

function buildAdminConfig(environment = process.env) {
  if ((environment.GENESIS_ENVIRONMENT ?? "").trim() !== expectedEnvironment) {
    throw failure("GENESIS_ENVIRONMENT_STAGING_REQUIRED");
  }
  if ((environment.GENESIS_STATE_BACKEND ?? "").trim()) {
    throw failure("GENESIS_STATE_BACKEND_MUST_BE_UNSET");
  }
  if ((environment.DB_HOST ?? "").trim().toLowerCase() !== expectedHost) {
    throw failure("STAGING_DB_HOST_MISMATCH");
  }
  if ((environment.DB_NAME ?? "").trim() !== expectedDatabase) {
    throw failure("STAGING_DB_NAME_MISMATCH");
  }
  if ((environment.DB_PORT ?? "").trim() !== "5432") {
    throw failure("STAGING_DB_PORT_MISMATCH");
  }

  const adminUsername = environment.DB_ADMIN_USERNAME?.trim();
  const adminPassword = environment.DB_ADMIN_PASSWORD;
  if (adminUsername !== expectedAdminUser || !adminPassword) {
    throw failure("STAGING_ADMIN_CREDENTIAL_REQUIRED");
  }
  validateRdsCaCertificate(environment);

  return postgresClientConfig({
    ...environment,
    DB_USERNAME: adminUsername,
    DB_PASSWORD: adminPassword,
  });
}

export function parseDiagnosticModeArg(argv) {
  if (argv.some((token) => token === "--sql" || token.startsWith("--sql="))) {
    throw failure("ARBITRARY_SQL_INPUT_REJECTED");
  }
  if (argv.length !== 1 || argv[0] !== DIAGNOSTIC_MODE) {
    throw failure("USAGE_DIAGNOSTIC_ONLY");
  }
}

export async function runAdminReadOnlyDiagnostic(environment = process.env, dependencies = {}) {
  const config = buildAdminConfig(environment);
  await verifyPrivateEndpoint(config.host, dependencies.dnsLookup ?? lookup);
  const client = dependencies.createClient ? dependencies.createClient(config) : new Client(config);
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    const query = async (name, params = []) => {
      const sql = QUERY_ALLOWLIST[name];
      if (!sql) throw failure("DB_DIAGNOSTIC_QUERY_REJECTED");
      return client.query(sql, params);
    };

    const tx = await query("readOnlySetting");
    if (tx.rows[0]?.tx !== "on") throw failure("READ_ONLY_TRANSACTION_REQUIRED");

    const identity = await query("identity");
    if (identity.rows[0]?.database !== expectedDatabase || identity.rows[0]?.username !== expectedAdminUser) {
      throw failure("ADMIN_IDENTITY_MISMATCH");
    }

    const adminCapabilities = await query("adminCapabilities");
    const targetRole = await query("targetRole", [snapshotReaderRole]);
    const roleMembership = await query("roleMembership", [snapshotReaderRole]);
    const grants = await query("grants", [snapshotReaderRole, expectedDatabase]);
    const publicTableGrants = await query("publicTableGrants");
    const tableOwner = await query("tableOwner");
    const defaultPrivileges = await query("defaultPrivileges");
    const businessNamespace = await query("businessNamespace", [namespace]);

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
  } catch (error) {
    const message = typeof error?.message === "string" ? error.message : "";
    if (/password authentication failed|28P01|28000|permission denied/i.test(message)) {
      throw failure("DB_ADMIN_AUTH_FAILED");
    }
    throw error;
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op
    }
    await client.end();
  }
}

