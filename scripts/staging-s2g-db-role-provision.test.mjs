import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import {
  parseDiagnosticModeArg,
  runAdminReadOnlyDiagnostic,
} from "./staging-s2g-db-role-provision.mjs";

const baseEnvironment = {
  GENESIS_ENVIRONMENT: "staging",
  DB_HOST: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
  DB_PORT: "5432",
  DB_NAME: "genesis_staging",
  GENESIS_RDS_CA_CERT: "infra/staging/certificates/aws-rds-global-bundle.pem",
  DB_ADMIN_USERNAME: "genesis_admin",
  DB_ADMIN_PASSWORD: "test-password",
};

function diagnosticClient() {
  const calls = [];
  return {
    calls,
    async connect() {
      calls.push("connect");
    },
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql === "BEGIN READ ONLY") return { rows: [] };
      if (sql.includes("current_setting('transaction_read_only')")) return { rows: [{ tx: "on" }] };
      if (sql.includes("current_database() AS database")) return { rows: [{ database: "genesis_staging", username: "genesis_admin" }] };
      if (sql.includes("FROM pg_roles WHERE rolname = current_user")) {
        return { rows: [{ rolsuper: false, rolcreaterole: true, rolcreatedb: false, rolreplication: false, rolbypassrls: false }] };
      }
      if (sql.includes("FROM pg_roles WHERE rolname = $1")) return { rowCount: 0, rows: [] };
      if (sql.includes("FROM pg_auth_members")) return { rows: [] };
      if (sql.includes("has_database_privilege")) {
        return {
          rows: [{
            can_connect: false,
            can_use_schema: false,
            can_create_schema: false,
            can_select_table: false,
            can_insert_table: false,
            can_update_table: false,
            can_delete_table: false,
            can_truncate_table: false,
          }],
        };
      }
      if (sql.includes("information_schema.table_privileges")) return { rows: [{ privilege_type: "SELECT" }] };
      if (sql.includes("FROM pg_class c")) return { rows: [{ owner: "genesis_admin" }] };
      if (sql.includes("FROM pg_default_acl")) return { rows: [] };
      if (sql.includes("FROM public.genesis_foundation_state")) {
        return { rows: [{ namespace: "share-to-grow-repository", schema_version: 1, revision: "38", updated_at: "2026-10-13T07:46:02.381Z", data_md5: "x" }] };
      }
      if (sql === "ROLLBACK") return { rows: [] };
      throw new Error(`Unexpected SQL in test: ${sql}`);
    },
    async end() {
      calls.push("end");
    },
  };
}

test("diagnostic mode fails closed for missing admin credential", async () => {
  await assert.rejects(
    runAdminReadOnlyDiagnostic({ ...baseEnvironment, DB_ADMIN_PASSWORD: "" }, { dnsLookup: async () => [{ address: "10.42.3.10" }] }),
    /STAGING_ADMIN_CREDENTIAL_REQUIRED/,
  );
});

test("diagnostic mode rejects wrong host and wrong database", async () => {
  await assert.rejects(
    runAdminReadOnlyDiagnostic({ ...baseEnvironment, DB_HOST: "genesis-production-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com" }),
    /STAGING_DB_HOST_MISMATCH/,
  );
  await assert.rejects(
    runAdminReadOnlyDiagnostic({ ...baseEnvironment, DB_NAME: "genesis" }),
    /STAGING_DB_NAME_MISMATCH/,
  );
});

test("diagnostic mode parser accepts only diagnostic command", () => {
  assert.doesNotThrow(() => parseDiagnosticModeArg(["--diagnose-admin-readonly"]));
  assert.throws(() => parseDiagnosticModeArg([]), /USAGE_DIAGNOSTIC_ONLY/);
  assert.throws(() => parseDiagnosticModeArg(["--prepare-provisioning-sql"]), /USAGE_DIAGNOSTIC_ONLY/);
  assert.throws(
    () => parseDiagnosticModeArg(["--diagnose-admin-readonly", "--sql", "SELECT 1"]),
    /ARBITRARY_SQL_INPUT_REJECTED/,
  );
});

test("diagnostic mode enforces private endpoint and read-only transaction", async () => {
  const client = diagnosticClient();
  const report = await runAdminReadOnlyDiagnostic(baseEnvironment, {
    dnsLookup: async () => [{ address: "10.42.0.55" }],
    createClient: () => client,
  });
  assert.equal(report.mode, "DIAGNOSTIC_ONLY");
  assert.equal(report.adminIdentity.username, "genesis_admin");
  assert.equal(report.targetRoleExists, false);
  assert.ok(client.calls.some((call) => call === "connect"));
  assert.ok(client.calls.some((call) => typeof call === "object" && call.sql === "BEGIN READ ONLY"));
});

test("script rejects provisioning and credential-generation modes", () => {
  for (const mode of ["--prepare-provisioning-sql", "--generate-reader-credential-handoff"]) {
    const result = spawnSync(process.execPath, ["scripts/staging-s2g-db-role-provision.mjs", mode], {
      cwd: resolve(import.meta.dirname, ".."),
      env: baseEnvironment,
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /code=USAGE_DIAGNOSTIC_ONLY/);
  }
});

test("script rejects arbitrary SQL argument injection", () => {
  const result = spawnSync(process.execPath, [
    "scripts/staging-s2g-db-role-provision.mjs",
    "--diagnose-admin-readonly",
    "--sql",
    "SELECT 1",
  ], {
    cwd: resolve(import.meta.dirname, ".."),
    env: baseEnvironment,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /code=ARBITRARY_SQL_INPUT_REJECTED/);
});
