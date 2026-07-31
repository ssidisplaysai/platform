import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FoundationPersistenceSerializationError,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

function makeTempRoot(label: string): string {
  return join(tmpdir(), `genesis-foundation-${label}-${Date.now()}-${Math.round(Math.random() * 100000)}`);
}

describe("foundation persistence build contract", () => {
  const originalPersistenceDir = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;

  afterEach(() => {
    if (originalPersistenceDir === undefined) {
      delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
      return;
    }

    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = originalPersistenceDir;
  });

  test("missing persisted state returns deterministic seed without creating artifacts", () => {
    const tempRoot = makeTempRoot("missing-state");
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = tempRoot;

    const state = loadPersistedState({
      namespace: "build-contract",
      seedFactory: () => ({ items: ["seed"] }),
    });

    expect(state.seeded).toBe(true);
    expect(state.revision).toBe(0);
    expect(state.state.items).toEqual(["seed"]);
    expect(existsSync(tempRoot)).toBe(false);
  });

  test("first save after missing state initializes directory and file safely", () => {
    const tempRoot = makeTempRoot("first-save");
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = tempRoot;

    const loaded = loadPersistedState({
      namespace: "build-contract",
      seedFactory: () => ({ items: ["seed"] }),
    });

    const saved = savePersistedState({
      namespace: "build-contract",
      state: { items: [...loaded.state.items, "mutated"] },
      expectedRevision: loaded.revision,
    });

    expect(saved.revision).toBe(1);
    expect(existsSync(tempRoot)).toBe(true);
    expect(existsSync(join(tempRoot, "build-contract.json"))).toBe(true);
  });

  test("malformed persisted state fails explicitly", () => {
    const tempRoot = makeTempRoot("malformed");
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = tempRoot;
    mkdirSync(tempRoot, { recursive: true });
    writeFileSync(join(tempRoot, "build-contract.json"), "{not valid json", "utf8");

    expect(() =>
      loadPersistedState({
        namespace: "build-contract",
        seedFactory: () => ({ items: [] }),
      }),
    ).toThrow(FoundationPersistenceSerializationError);
  });

  test("repository import does not create persisted-state artifacts when state is missing", async () => {
    const tempRoot = makeTempRoot("import-safe");
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = tempRoot;
    jest.resetModules();

    const routingRepository = await import("@/modules/foundation/routing-repository");

    expect(Array.isArray(routingRepository.listRoutings())).toBe(true);
    expect(existsSync(tempRoot)).toBe(false);
  });
});
