import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FoundationPersistenceError } from "../foundation-persistence";
import {
  assertProductionPostgresRuntimeConfiguration,
  resolveFoundationPersistenceBackend,
} from "../production-persistence-guards";

describe("production persistence guards", () => {
  function expectErrorCode(input: () => unknown, code: string) {
    try {
      input();
      throw new Error("EXPECTED_ERROR_NOT_THROWN");
    } catch (error) {
      expect(error).toBeInstanceOf(FoundationPersistenceError);
      expect((error as FoundationPersistenceError).code).toBe(code);
    }
  }

  test("production with missing backend fails closed", () => {
    expectErrorCode(() => resolveFoundationPersistenceBackend({
      GENESIS_ENVIRONMENT: "production",
    }), "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION");
  });

  test("production with filesystem backend fails closed", () => {
    expectErrorCode(() => resolveFoundationPersistenceBackend({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_STATE_BACKEND: "filesystem",
    }), "PERSISTENCE_BACKEND_REQUIRED_IN_PRODUCTION");
  });

  test("unsupported backend fails closed", () => {
    expectErrorCode(() => resolveFoundationPersistenceBackend({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_STATE_BACKEND: "sqlite",
    }), "PERSISTENCE_BACKEND_UNSUPPORTED");
  });

  test("production postgres with missing DB config fails closed", () => {
    expectErrorCode(() => assertProductionPostgresRuntimeConfiguration({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_STATE_BACKEND: "postgres",
      DB_HOST: "db.internal",
      DB_PORT: "5432",
      DB_NAME: "genesis",
    }), "PERSISTENCE_DATABASE_CONFIGURATION_INVALID");
  });

  test("production postgres with missing CA fails closed", () => {
    expectErrorCode(() => assertProductionPostgresRuntimeConfiguration({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_STATE_BACKEND: "postgres",
      DB_HOST: "db.internal",
      DB_PORT: "5432",
      DB_NAME: "genesis",
      DB_USERNAME: "genesis_share_to_grow_app",
      DB_PASSWORD: "not-empty",
    }), "PERSISTENCE_TLS_CONFIGURATION_REQUIRED_IN_PRODUCTION");
  });

  test("production postgres guard requires CA declaration; path readability is enforced by TLS loader", () => {
    const caPath = join(tmpdir(), "non-existent-ca.pem");
    expect(() => assertProductionPostgresRuntimeConfiguration({
      GENESIS_ENVIRONMENT: "production",
      GENESIS_STATE_BACKEND: "postgres",
      DB_HOST: "db.internal",
      DB_PORT: "5432",
      DB_NAME: "genesis",
      DB_USERNAME: "genesis_share_to_grow_app",
      DB_PASSWORD: "not-empty",
      GENESIS_RDS_CA_CERT: caPath,
    })).not.toThrow();
  });

  test("production postgres with valid CA and DB configuration passes", () => {
    const caDirectory = mkdtempSync(join(tmpdir(), "s2g-guard-ca-"));
    const caPath = join(caDirectory, "ca.pem");
    writeFileSync(caPath, "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n", "utf8");

    try {
      expect(() => assertProductionPostgresRuntimeConfiguration({
        GENESIS_ENVIRONMENT: "production",
        GENESIS_STATE_BACKEND: "postgres",
        DB_HOST: "db.internal",
        DB_PORT: "5432",
        DB_NAME: "genesis",
        DB_USERNAME: "genesis_share_to_grow_app",
        DB_PASSWORD: "not-empty",
        GENESIS_RDS_CA_CERT: caPath,
      })).not.toThrow();
    } finally {
      rmSync(caDirectory, { recursive: true, force: true });
    }
  });
});
