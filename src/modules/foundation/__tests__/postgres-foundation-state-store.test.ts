import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const mockQuery = jest.fn();
const mockEnd = jest.fn();
const mockPool = jest.fn().mockImplementation(() => ({
  query: mockQuery,
  end: mockEnd,
}));

jest.mock("pg", () => ({
  Pool: mockPool,
}));

import {
  FoundationPersistenceConflictError,
  FoundationPersistenceError,
} from "../foundation-persistence";
import { createPostgresFoundationStateStore } from "../postgres-foundation-state-store";

describe("PostgreSQL foundation state store", () => {
  function expectErrorCode(input: () => unknown, code: string) {
    try {
      input();
      throw new Error("EXPECTED_ERROR_NOT_THROWN");
    } catch (error) {
      expect(error).toBeInstanceOf(FoundationPersistenceError);
      expect((error as FoundationPersistenceError).code).toBe(code);
    }
  }

  const originalEnvironment = {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_PORT: process.env.DB_PORT,
    GENESIS_ENVIRONMENT: process.env.GENESIS_ENVIRONMENT,
    GENESIS_STATE_BACKEND: process.env.GENESIS_STATE_BACKEND,
    GENESIS_RDS_CA_CERT: process.env.GENESIS_RDS_CA_CERT,
  };

  beforeEach(() => {
    process.env.DB_HOST = "staging.example.internal";
    process.env.DB_NAME = "genesis_staging";
    process.env.DB_USERNAME = "staging";
    process.env.DB_PASSWORD = "test-only-password";
    process.env.DB_PORT = "5432";
    mockQuery.mockReset();
    mockEnd.mockReset().mockResolvedValue(undefined);
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    mockPool.mockClear();
    delete process.env.GENESIS_ENVIRONMENT;
    delete process.env.GENESIS_STATE_BACKEND;
    delete process.env.GENESIS_RDS_CA_CERT;
  });

  afterEach(() => {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  test("loads an absent namespace as a seed without persisting it", async () => {
    const store = createPostgresFoundationStateStore();
    const seed = { ledgerEntries: [] };

    await expect(store.load({ namespace: "share-to-grow", seedFactory: () => seed })).resolves.toEqual({
      state: seed,
      revision: 0,
      seeded: true,
    });
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("FROM public.genesis_foundation_state"),
      ["share-to-grow"],
    );
  });

  test("conditionally creates revision one and does not report a successful lost race", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [{ schema_version: 1, revision: "3" }], rowCount: 1 });
    const store = createPostgresFoundationStateStore();

    await expect(store.save({
      namespace: "share-to-grow",
      state: { ledgerEntries: [] },
      expectedRevision: 0,
    })).rejects.toBeInstanceOf(FoundationPersistenceConflictError);
    expect(mockQuery.mock.calls[0][0]).toContain("ON CONFLICT (namespace) DO NOTHING");
    expect(mockQuery.mock.calls[0][1]).toContain(JSON.stringify({ ledgerEntries: [] }));
  });

  test("readiness checks the expected table shape and reports an incompatible schema", async () => {
    mockQuery.mockRejectedValueOnce({ code: "42703" });
    const store = createPostgresFoundationStateStore();

    await expect(store.check()).rejects.toMatchObject({
      code: "PERSISTENCE_SCHEMA_MISMATCH",
    } satisfies Partial<FoundationPersistenceError>);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT schema_version, revision, updated_at, data"),
    );
  });

  test("production postgres requires explicit GENESIS_RDS_CA_CERT", () => {
    process.env.GENESIS_ENVIRONMENT = "production";
    process.env.GENESIS_STATE_BACKEND = "postgres";
    delete process.env.GENESIS_RDS_CA_CERT;

    expectErrorCode(() => createPostgresFoundationStateStore(), "PERSISTENCE_TLS_CONFIGURATION_REQUIRED_IN_PRODUCTION");
    expect(mockPool).not.toHaveBeenCalled();
  });

  test("production postgres rejects unreadable CA path", () => {
    process.env.GENESIS_ENVIRONMENT = "production";
    process.env.GENESIS_STATE_BACKEND = "postgres";
    process.env.GENESIS_RDS_CA_CERT = join(tmpdir(), "missing-rds-ca.pem");

    expectErrorCode(() => createPostgresFoundationStateStore(), "PERSISTENCE_TLS_CONFIGURATION_INVALID");
    expect(mockPool).not.toHaveBeenCalled();
  });

  test("production postgres accepts valid DB configuration and resolvable CA path", async () => {
    const caDir = mkdtempSync(join(tmpdir(), "s2g-ca-"));
    const caPath = join(caDir, "rds-ca.pem");
    writeFileSync(
      caPath,
      "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n",
      "utf8",
    );

    process.env.GENESIS_ENVIRONMENT = "production";
    process.env.GENESIS_STATE_BACKEND = "postgres";
    process.env.GENESIS_RDS_CA_CERT = caPath;

    try {
      const store = createPostgresFoundationStateStore();
      await expect(store.close()).resolves.toBeUndefined();
      expect(mockPool).toHaveBeenCalledWith(expect.objectContaining({
        host: "staging.example.internal",
        database: "genesis_staging",
        user: "staging",
        ssl: expect.objectContaining({ rejectUnauthorized: true }),
      }));
    } finally {
      rmSync(caDir, { recursive: true, force: true });
    }
  });
});
