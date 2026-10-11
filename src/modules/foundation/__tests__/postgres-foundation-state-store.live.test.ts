import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  FoundationPersistenceConflictError,
} from "../foundation-persistence";
import { createPostgresFoundationStateStore } from "../postgres-foundation-state-store";

const enabled = process.env.POSTGRES_LIVE_CERTIFICATION === "1";

(enabled ? describe : describe.skip)("live staging PostgreSQL foundation state certification", () => {
  const config = {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_NAME: process.env.DB_NAME,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
  };
  const integrationNamespace = `staging-certification:${randomUUID()}`;
  const concurrencyNamespace = `staging-certification:${randomUUID()}`;
  const ownedNamespaces = [integrationNamespace, concurrencyNamespace];

  function createStore(applicationName: string) {
    return createPostgresFoundationStateStore({ applicationName });
  }

  afterAll(async () => {
    const cleanupPool = new Pool({
      host: config.DB_HOST,
      port: Number(config.DB_PORT || "5432"),
      database: config.DB_NAME,
      user: config.DB_USERNAME,
      password: config.DB_PASSWORD,
      ssl: { rejectUnauthorized: true },
      max: 1,
      application_name: "genesis-staging-postgres-certification-cleanup",
    });
    try {
      await cleanupPool.query(
        "DELETE FROM public.genesis_foundation_state WHERE namespace = ANY($1::text[])",
        [ownedNamespaces.filter((namespace) => namespace.startsWith("staging-certification:"))],
      );
    } finally {
      await cleanupPool.end();
    }
  });

  test("write, read, update, reconnect, and verify JSON persistence", async () => {
    const firstClient = createStore("genesis-staging-certification-integration-1");
    let updatedState: { certification: boolean; entries: string[] } | undefined;
    try {
      const empty = await firstClient.load({
        namespace: integrationNamespace,
        seedFactory: () => ({ certification: true, entries: [] as string[] }),
      });
      expect(empty.seeded).toBe(true);
      expect(empty.revision).toBe(0);

      const firstState = { certification: true, entries: ["written"] };
      await expect(firstClient.save({
        namespace: integrationNamespace,
        state: firstState,
        expectedRevision: empty.revision,
      })).resolves.toEqual({ revision: 1 });
      await expect(firstClient.load({
        namespace: integrationNamespace,
        seedFactory: () => ({ certification: true, entries: [] as string[] }),
      })).resolves.toMatchObject({ state: firstState, revision: 1, seeded: false });

      updatedState = { certification: true, entries: ["written", "updated"] };
      await expect(firstClient.save({
        namespace: integrationNamespace,
        state: updatedState,
        expectedRevision: 1,
      })).resolves.toEqual({ revision: 2 });
    } finally {
      await firstClient.close();
    }

    const reconnectedClient = createStore("genesis-staging-certification-integration-2");
    try {
      expect(updatedState).toBeDefined();
      await expect(reconnectedClient.load({
        namespace: integrationNamespace,
        seedFactory: () => ({ certification: true, entries: [] as string[] }),
      })).resolves.toMatchObject({ state: updatedState, revision: 2, seeded: false });
    } finally {
      await reconnectedClient.close();
    }
  });

  test("two independent adapter pools reject the stale concurrent writer", async () => {
    const firstClient = createStore("genesis-staging-certification-race-1");
    const secondClient = createStore("genesis-staging-certification-race-2");
    const observer = new Pool({
      host: config.DB_HOST,
      port: Number(config.DB_PORT || "5432"),
      database: config.DB_NAME,
      user: config.DB_USERNAME,
      password: config.DB_PASSWORD,
      ssl: { rejectUnauthorized: true },
      max: 1,
      application_name: "genesis-staging-certification-race-observer",
    });
    try {
      const seed = { certification: true, winner: "seed", records: ["base"] };
      await firstClient.save({ namespace: concurrencyNamespace, state: seed, expectedRevision: 0 });
      const initial = await Promise.all([
        firstClient.load({ namespace: concurrencyNamespace, seedFactory: () => seed }),
        secondClient.load({ namespace: concurrencyNamespace, seedFactory: () => seed }),
      ]);
      expect(initial.map(({ revision }) => revision)).toEqual([1, 1]);

      const sessions = await observer.query(
        `SELECT application_name, pid
         FROM pg_stat_activity
         WHERE application_name = ANY($1::text[])`,
        [
          [
            "genesis-staging-certification-race-1",
            "genesis-staging-certification-race-2",
          ],
        ],
      );
      const sessionPids = new Set(sessions.rows.map(({ pid }) => pid));
      expect(sessionPids.size).toBe(2);

      let ready = 0;
      let release!: () => void;
      const start = new Promise<void>((resolve) => {
        release = resolve;
      });
      const contend = async (
        store: ReturnType<typeof createStore>,
        state: { certification: boolean; winner: string; records: string[] },
      ) => {
        const snapshot = await store.load({ namespace: concurrencyNamespace, seedFactory: () => seed });
        expect(snapshot.revision).toBe(1);
        ready += 1;
        if (ready === 2) release();
        await start;
        return store.save({
          namespace: concurrencyNamespace,
          state,
          expectedRevision: snapshot.revision,
        });
      };
      const results = await Promise.allSettled([
        contend(firstClient, { certification: true, winner: "client-1", records: ["base", "one"] }),
        contend(secondClient, { certification: true, winner: "client-2", records: ["base", "two"] }),
      ]);
      const accepted = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      expect(accepted).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0]).toMatchObject({
        status: "rejected",
        reason: expect.any(FoundationPersistenceConflictError),
      });

      const finalState = await firstClient.load({
        namespace: concurrencyNamespace,
        seedFactory: () => seed,
      });
      expect(finalState.seeded).toBe(false);
      expect(finalState.revision).toBe(2);
      expect(finalState.state).toMatchObject({
        certification: true,
        winner: expect.stringMatching(/^client-[12]$/),
      });
      expect(finalState.state.records).toContain("base");
      const row = await observer.query(
        `SELECT count(*)::integer AS count, bool_and(jsonb_typeof(data) = 'object') AS valid_json
         FROM public.genesis_foundation_state
         WHERE namespace = $1`,
        [concurrencyNamespace],
      );
      expect(row.rows[0]).toEqual({ count: 1, valid_json: true });
    } finally {
      await Promise.all([firstClient.close(), secondClient.close(), observer.end()]);
    }
  });
});
