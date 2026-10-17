import { readFileSync } from "node:fs";
import { runProbe } from "../../../../scripts/staging-runtime-postgres-probe";

const environment = {
  GENESIS_ENVIRONMENT: "staging",
  GENESIS_STATE_BACKEND: "postgres",
  DB_HOST: "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com",
  DB_PORT: "5432",
  DB_NAME: "genesis_staging",
  GENESIS_RDS_CA_CERT: "/app/certs/rds-global-bundle.pem",
};

const ca = readFileSync("infra/staging/certificates/aws-rds-global-bundle.pem");

function fakeStore() {
  const calls: unknown[] = [];
  const store = {
    backend: "postgres" as const,
    async load(input: unknown) {
      calls.push({ kind: "load", input });
      return { state: foundationState, revision: 24, seeded: false };
    },
    async close() {
      calls.push({ kind: "close" });
    },
  };
  return { store, calls };
}

const foundationState = {
  participants: [],
  trackingIdentities: [],
  ruleVersions: [],
  ledgerEntries: [{ id: "safe-count-only" }],
  sourceEventReceipts: [],
  processedCommerceLines: [],
  payoutEntitlements: [],
  commerceAdjustments: [],
};

const run = (env: typeof environment, store: ReturnType<typeof fakeStore>["store"]) =>
  runProbe(env, () => store, () => ca);

beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("requires staging and PostgreSQL backend", async () => {
  const { store } = fakeStore();
  await expect(run({ ...environment, GENESIS_ENVIRONMENT: "production" }, store))
    .rejects.toThrow("GENESIS_ENVIRONMENT=staging");
  await expect(run({ ...environment, GENESIS_STATE_BACKEND: "filesystem" }, store))
    .rejects.toThrow("GENESIS_STATE_BACKEND=postgres");
});

test("requires the exact staging database target, port, and CA path", async () => {
  const { store } = fakeStore();
  await expect(run({ ...environment, DB_HOST: "production-db.example" }, store))
    .rejects.toThrow("database target");
  await expect(run({ ...environment, DB_NAME: "production" }, store))
    .rejects.toThrow("database target");
  await expect(run({ ...environment, DB_PORT: "5433" }, store))
    .rejects.toThrow("DB_PORT=5432");
  await expect(run({ ...environment, GENESIS_RDS_CA_CERT: "/wrong.pem" }, store))
    .rejects.toThrow("approved RDS CA path");
});

test("selects the canonical Postgres store and loads only the business namespace", async () => {
  const { store, calls } = fakeStore();
  await run(environment, store);
  expect(calls).toHaveLength(2);
  expect(calls[0]).toMatchObject({
    kind: "load",
    input: { namespace: "share-to-grow-repository" },
  });
  expect(calls[1]).toEqual({ kind: "close" });
  expect(console.log).toHaveBeenCalledWith("GENESIS_PERSISTENCE_BACKEND_SELECTED backend=postgres");
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining("STAGING_RUNTIME_POSTGRES_PROBE=PASS"));
});

test("fails closed when canonical store is not Postgres or business state is unexpected", async () => {
  const wrongBackend = fakeStore();
  wrongBackend.store.backend = "filesystem";
  await expect(run(environment, wrongBackend.store)).rejects.toThrow("did not select PostgreSQL");

  const wrongRevision = fakeStore();
  wrongRevision.store.load = async () => ({ state: foundationState, revision: 23, seeded: false });
  await expect(run(environment, wrongRevision.store)).rejects.toThrow("metadata differs");
});

test("reports counts only and does not expose sensitive data or a write method", async () => {
  const { store, calls } = fakeStore();
  await run(environment, store);
  expect(store).not.toHaveProperty("save");
  expect(store).not.toHaveProperty("reset");
  const logged = (console.log as jest.Mock).mock.calls.flat().join("\n");
  expect(logged).toContain('"ledgerEntries":1');
  expect(logged).not.toContain("safe-count-only");
  expect(logged).not.toContain("password");
  expect(logged).not.toContain(environment.DB_HOST);
  expect(calls.filter((call) => (call as { kind?: string }).kind === "load")).toHaveLength(1);
});
