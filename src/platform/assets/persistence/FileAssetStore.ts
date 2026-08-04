import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createDefaultAssetPersistedState, type AssetPersistedState } from "../contracts";
import type { AssetStore } from "./types";

type FileAssetStoreOptions = {
  rootDir: string;
};

function normalize(raw: unknown): AssetPersistedState {
  if (!raw || typeof raw !== "object") {
    return createDefaultAssetPersistedState();
  }

  const candidate = raw as Partial<AssetPersistedState>;
  if (candidate.schemaVersion !== "1.0.0") {
    return createDefaultAssetPersistedState();
  }

  const defaults = createDefaultAssetPersistedState();
  return {
    schemaVersion: "1.0.0",
    assets: Array.isArray(candidate.assets) ? candidate.assets : [],
    relationships: Array.isArray(candidate.relationships) ? candidate.relationships : [],
    collections: Array.isArray(candidate.collections) ? candidate.collections : [],
    audits: Array.isArray(candidate.audits) ? candidate.audits : [],
    metrics: candidate.metrics ?? defaults.metrics,
  };
}

export class FileAssetStore implements AssetStore {
  private readonly filePath: string;
  private lock: Promise<void> = Promise.resolve();

  constructor(options: FileAssetStoreOptions) {
    this.filePath = resolve(options.rootDir, "assets", "asset-state.v1.json");
  }

  private async ensureDir(): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const wait = this.lock;
    let release: () => void = () => undefined;
    this.lock = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await wait;

    try {
      return await operation();
    } finally {
      release();
    }
  }

  async load(): Promise<AssetPersistedState> {
    return this.withLock(async () => {
      try {
        const payload = await readFile(this.filePath, "utf8");
        return normalize(JSON.parse(payload) as unknown);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException | undefined)?.code;
        if (code === "ENOENT") {
          const state = createDefaultAssetPersistedState();
          await this.ensureDir();
          await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
          return state;
        }
        return createDefaultAssetPersistedState();
      }
    });
  }

  async save(state: AssetPersistedState): Promise<void> {
    return this.withLock(async () => {
      await this.ensureDir();
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    });
  }
}
