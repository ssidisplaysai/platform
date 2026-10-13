import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  getFoundationStateStore,
  type FoundationStateStore,
} from "../src/modules/foundation/foundation-state-store";
import type { ShareToGrowRepositoryState } from "../src/modules/share-to-grow/persistence-types";

const EXPECTED_HOST = "genesis-staging-postgres.cnok4aok0ihf.us-west-2.rds.amazonaws.com";
const EXPECTED_DATABASE = "genesis_staging";
const EXPECTED_CA_PATH = "/app/certs/rds-global-bundle.pem";
const EXPECTED_CA_SHA256 = "fe45bbebf92ad3e27a583bbb2ddd1553c521ed4d49af5514dc0a40372ea5395c";
const NAMESPACE = "share-to-grow-repository";

type ReadOnlyStore = Pick<FoundationStateStore, "backend" | "load" | "close">;
type Environment = Record<string, string | undefined>;

function requireExactEnvironment(environment: Environment): void {
  if (environment.GENESIS_ENVIRONMENT !== "staging") {
    throw new Error("probe requires GENESIS_ENVIRONMENT=staging");
  }
  if (environment.GENESIS_STATE_BACKEND !== "postgres") {
    throw new Error("probe requires GENESIS_STATE_BACKEND=postgres");
  }

  const host = environment.DB_HOST?.trim();
  const database = environment.DB_NAME?.trim();
  if (
    host !== EXPECTED_HOST
    || database !== EXPECTED_DATABASE
    || /prod/i.test(host ?? "")
    || /prod/i.test(database ?? "")
  ) {
    throw new Error("probe database target differs from the approved staging PostgreSQL target");
  }
  if (environment.DB_PORT?.trim() !== "5432") {
    throw new Error("probe requires DB_PORT=5432");
  }
  if (environment.GENESIS_RDS_CA_CERT?.trim() !== EXPECTED_CA_PATH) {
    throw new Error("probe requires the approved RDS CA path");
  }
}

function validateCa(readCa: () => Buffer): void {
  let ca: Buffer;
  try {
    ca = readCa();
  } catch {
    throw new Error("approved RDS CA certificate is not readable");
  }
  const checksum = createHash("sha256").update(ca).digest("hex");
  if (checksum !== EXPECTED_CA_SHA256) {
    throw new Error("approved RDS CA certificate checksum does not match");
  }
}

function collectionCounts(data: unknown): Record<string, number> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("persisted foundation state is not a JSON object");
  }
  const state = data as Record<string, unknown>;
  const collections = [
    "participants",
    "trackingIdentities",
    "ruleVersions",
    "ledgerEntries",
    "sourceEventReceipts",
    "processedCommerceLines",
    "payoutEntitlements",
    "commerceAdjustments",
  ] as const;
  return Object.fromEntries(collections.map((name) => {
    const value = state[name];
    if (!Array.isArray(value)) throw new Error(`persisted collection ${name} is not an array`);
    return [name, value.length];
  }));
}

export async function runProbe(
  environment: Environment = process.env,
  selectStore: () => ReadOnlyStore = getFoundationStateStore,
  readCa: () => Buffer = () => readFileSync(EXPECTED_CA_PATH),
): Promise<void> {
  requireExactEnvironment(environment);
  validateCa(readCa);
  const store = selectStore();
  if (store.backend !== "postgres") throw new Error("canonical foundation store did not select PostgreSQL");
  console.log("GENESIS_PERSISTENCE_BACKEND_SELECTED backend=postgres");

  try {
    const loaded = await store.load<ShareToGrowRepositoryState>({
      namespace: NAMESPACE,
      seedFactory: () => {
        throw new Error("canonical business namespace must already exist");
      },
    });
    if (loaded.seeded || loaded.revision !== 24) {
      throw new Error("canonical business namespace metadata differs from the certified expectation");
    }
    const counts = collectionCounts(loaded.state);
    // The canonical adapter only deserializes rows with its schema version (1).
    console.log(`STAGING_RUNTIME_POSTGRES_PROBE_METADATA=${JSON.stringify({
      namespace: NAMESPACE,
      schemaVersion: 1,
      revision: loaded.revision,
      counts,
    })}`);
    console.log("STAGING_RUNTIME_POSTGRES_PROBE=PASS");
  } finally {
    await store.close();
  }
}

if (require.main === module) {
  runProbe().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown probe failure";
    console.error(`STAGING_RUNTIME_POSTGRES_PROBE=FAIL reason=${message}`);
    process.exitCode = 1;
  });
}
