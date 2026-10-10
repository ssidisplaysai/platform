const mockQuery = jest.fn();
const mockEnd = jest.fn();

jest.mock("pg", () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
  })),
}));

import {
  FoundationPersistenceConflictError,
  FoundationPersistenceError,
} from "../foundation-persistence";
import { createPostgresFoundationStateStore } from "../postgres-foundation-state-store";

describe("PostgreSQL foundation state store", () => {
  const originalEnvironment = {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_PORT: process.env.DB_PORT,
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
  });

  afterEach(async () => {
    await createPostgresFoundationStateStore().close();
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
});
