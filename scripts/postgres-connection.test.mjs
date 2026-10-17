import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { postgresClientConfig } from "./postgres-connection.mjs";
import { validateRdsCaCertificate } from "./postgres-ca-preflight.mjs";

const baseEnvironment = {
  DB_HOST: "db.example.test",
  DB_PORT: "5432",
  DB_NAME: "genesis_staging",
  DB_USERNAME: "genesis_app",
  DB_PASSWORD: "test-password",
};

test("PostgreSQL TLS verification stays enabled without a configured CA", () => {
  const config = postgresClientConfig(baseEnvironment);
  assert.deepEqual(config.ssl, { rejectUnauthorized: true });
});

test("PostgreSQL client loads the configured CA file and retains strict verification", () => {
  const directory = mkdtempSync(join(tmpdir(), "postgres-ca-"));
  const caPath = join(directory, "ca.pem");
  const pem = "-----BEGIN CERTIFICATE-----\nY2VydGlmaWNhdGU=\n-----END CERTIFICATE-----\n";
  try {
    writeFileSync(caPath, pem);
    const config = postgresClientConfig({ ...baseEnvironment, GENESIS_RDS_CA_CERT: caPath });
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.ca, pem);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("PostgreSQL client fails when the configured CA path is missing", () => {
  assert.throws(
    () => postgresClientConfig({ ...baseEnvironment, GENESIS_RDS_CA_CERT: join(tmpdir(), "missing-rds-ca.pem") }),
    /GENESIS_RDS_CA_CERT must contain a PEM certificate or reference an existing PEM file/,
  );
});

test("RDS certification requires its official bundle and passes it to strict TLS configuration", () => {
  const caPath = join(import.meta.dirname, "../infra/staging/certificates/aws-rds-global-bundle.pem");
  assert.throws(() => validateRdsCaCertificate({}), /GENESIS_RDS_CA_CERT/);

  const environment = { ...baseEnvironment, GENESIS_RDS_CA_CERT: caPath };
  assert.doesNotThrow(() => validateRdsCaCertificate(environment));
  const config = postgresClientConfig(environment);
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.match(config.ssl.ca, /-----BEGIN CERTIFICATE-----/);
});
